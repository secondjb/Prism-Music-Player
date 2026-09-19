use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use windows::core::*;
use windows::Win32::Foundation::*;
use windows::Win32::Graphics::Gdi::*;
use windows::Win32::System::Com::*;
use windows::Win32::UI::Shell::{
    DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass, ITaskbarList3, TaskbarList,
    THUMBBUTTON, THBF_ENABLED, THBN_CLICKED, THB_FLAGS, THB_ICON, THB_TOOLTIP,
};
use windows::Win32::UI::WindowsAndMessaging::*;

pub const ID_THUMBBUTTON_PREV: u32 = 1001;
pub const ID_THUMBBUTTON_PLAY_PAUSE: u32 = 1002;
pub const ID_THUMBBUTTON_NEXT: u32 = 1003;

const SUBCLASS_ID: usize = 42001;
const WM_UPDATE_PLAY_STATE: u32 = WM_APP + 101;

static GLOBAL_HWND: OnceLock<isize> = OnceLock::new();
static GLOBAL_APP: OnceLock<AppHandle> = OnceLock::new();
static IS_PLAYING: AtomicBool = AtomicBool::new(false);

struct TaskbarResources {
    taskbar: ITaskbarList3,
    icon_prev: HICON,
    icon_play: HICON,
    icon_pause: HICON,
    icon_next: HICON,
}

unsafe impl Send for TaskbarResources {}

static TASKBAR_RES: Mutex<Option<TaskbarResources>> = Mutex::new(None);

fn copy_to_sz_tip(text: &str, dest: &mut [u16; 260]) {
    dest.fill(0);
    for (i, code_unit) in text.encode_utf16().take(259).enumerate() {
        dest[i] = code_unit;
    }
}

/// Creates an anti-aliased, 32-bit ARGB high-DPI icon in memory.
unsafe fn create_media_icon(symbol: &str, size: i32) -> Result<HICON> {
    let ssaa = 4;
    let ssaa_f = ssaa as f32;
    let total_samples = (ssaa * ssaa) as f32;
    let size_f = size as f32;
    let mut bgra = vec![0u8; (size * size * 4) as usize];

    for y in 0..size {
        for x in 0..size {
            let mut inside_count = 0;
            for sy in 0..ssaa {
                for sx in 0..ssaa {
                    let u = (x as f32 + (sx as f32 + 0.5) / ssaa_f) / size_f;
                    let v = (y as f32 + (sy as f32 + 0.5) / ssaa_f) / size_f;

                    let is_inside = match symbol {
                        "play" => {
                            let left = 0.25;
                            let right = 0.80;
                            let cy = 0.50;
                            let half_h_max = 0.34;
                            if u >= left && u <= right {
                                let half_h = half_h_max * (right - u) / (right - left);
                                v >= cy - half_h && v <= cy + half_h
                            } else {
                                false
                            }
                        }
                        "pause" => {
                            let v_ok = v >= 0.16 && v <= 0.84;
                            let bar1 = u >= 0.19 && u <= 0.39;
                            let bar2 = u >= 0.61 && u <= 0.81;
                            v_ok && (bar1 || bar2)
                        }
                        "prev" => {
                            let v_ok = v >= 0.16 && v <= 0.84;
                            let bar = v_ok && u >= 0.11 && u <= 0.21;
                            let tip = 0.27;
                            let base = 0.85;
                            let cy = 0.50;
                            let half_h_max = 0.34;
                            let tri = if u >= tip && u <= base {
                                let half_h = half_h_max * (u - tip) / (base - tip);
                                v >= cy - half_h && v <= cy + half_h
                            } else {
                                false
                            };
                            bar || tri
                        }
                        "next" => {
                            let base = 0.15;
                            let tip = 0.73;
                            let cy = 0.50;
                            let half_h_max = 0.34;
                            let tri = if u >= base && u <= tip {
                                let half_h = half_h_max * (tip - u) / (tip - base);
                                v >= cy - half_h && v <= cy + half_h
                            } else {
                                false
                            };
                            let v_ok = v >= 0.16 && v <= 0.84;
                            let bar = v_ok && u >= 0.79 && u <= 0.89;
                            tri || bar
                        }
                        _ => false,
                    };

                    if is_inside {
                        inside_count += 1;
                    }
                }
            }

            let alpha = ((inside_count as f32 / total_samples) * 255.0).round() as u8;
            let offset = ((y * size + x) * 4) as usize;
            // Pre-multiplied 32-bit ARGB (BGRA order in memory for Win32 DIB)
            bgra[offset] = alpha;     // Blue
            bgra[offset + 1] = alpha; // Green
            bgra[offset + 2] = alpha; // Red
            bgra[offset + 3] = alpha; // Alpha
        }
    }

    let bmi = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: size,
            biHeight: -size, // top-down DIB
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };

    let mut bits: *mut core::ffi::c_void = std::ptr::null_mut();
    let hdc = GetDC(None);
    let hbm_color = CreateDIBSection(hdc, &bmi, DIB_RGB_COLORS, &mut bits, None, 0)?;
    ReleaseDC(None, hdc);

    if !bits.is_null() {
        std::ptr::copy_nonoverlapping(bgra.as_ptr(), bits as *mut u8, bgra.len());
    }

    let hbm_mask = CreateBitmap(size, size, 1, 1, None);

    let icon_info = ICONINFO {
        fIcon: BOOL::from(true),
        xHotspot: 0,
        yHotspot: 0,
        hbmMask: hbm_mask,
        hbmColor: hbm_color,
    };

    let hicon = CreateIconIndirect(&icon_info);

    let _ = DeleteObject(hbm_color);
    let _ = DeleteObject(hbm_mask);

    hicon
}

unsafe extern "system" fn taskbar_subclass_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
    _id: usize,
    _ref_data: usize,
) -> LRESULT {
    match msg {
        WM_COMMAND => {
            let notification_code = ((wparam.0 >> 16) & 0xFFFF) as u32;
            let button_id = (wparam.0 & 0xFFFF) as u32;

            if notification_code == THBN_CLICKED {
                if let Some(app) = GLOBAL_APP.get() {
                    match button_id {
                        ID_THUMBBUTTON_PREV => {
                            let _ = app.emit("media-prev", ());
                        }
                        ID_THUMBBUTTON_PLAY_PAUSE => {
                            let _ = app.emit("media-toggle", ());
                        }
                        ID_THUMBBUTTON_NEXT => {
                            let _ = app.emit("media-next", ());
                        }
                        _ => {}
                    }
                }
                return LRESULT(0);
            }
        }
        WM_UPDATE_PLAY_STATE => {
            let is_playing = wparam.0 != 0;
            if let Ok(guard) = TASKBAR_RES.lock() {
                if let Some(res) = guard.as_ref() {
                    let mut play_button = THUMBBUTTON {
                        dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
                        iId: ID_THUMBBUTTON_PLAY_PAUSE,
                        iBitmap: 0,
                        hIcon: if is_playing { res.icon_pause } else { res.icon_play },
                        szTip: [0; 260],
                        dwFlags: THBF_ENABLED,
                    };
                    let tip = if is_playing { "Pause" } else { "Play" };
                    copy_to_sz_tip(tip, &mut play_button.szTip);

                    let _ = res.taskbar.ThumbBarUpdateButtons(hwnd, &[play_button]);
                }
            }
            return LRESULT(0);
        }
        WM_NCDESTROY => {
            let _ = RemoveWindowSubclass(hwnd, Some(taskbar_subclass_proc), SUBCLASS_ID);
            if let Ok(mut guard) = TASKBAR_RES.lock() {
                if let Some(res) = guard.take() {
                    let _ = DestroyIcon(res.icon_prev);
                    let _ = DestroyIcon(res.icon_play);
                    let _ = DestroyIcon(res.icon_pause);
                    let _ = DestroyIcon(res.icon_next);
                }
            }
        }
        _ => {}
    }

    DefSubclassProc(hwnd, msg, wparam, lparam)
}

pub fn init_taskbar(app: &AppHandle, hwnd_raw: isize) -> std::result::Result<(), String> {
    let hwnd = HWND(hwnd_raw as *mut _);
    let _ = GLOBAL_HWND.set(hwnd_raw);
    let _ = GLOBAL_APP.set(app.clone());

    unsafe {
        let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

        if !SetWindowSubclass(hwnd, Some(taskbar_subclass_proc), SUBCLASS_ID, 0).as_bool() {
            return Err("Failed to set window subclass".to_string());
        }

        let taskbar: ITaskbarList3 = CoCreateInstance(&TaskbarList, None, CLSCTX_INPROC_SERVER)
            .map_err(|e| format!("CoCreateInstance failed: {}", e))?;
        taskbar.HrInit().map_err(|e| format!("HrInit failed: {}", e))?;

        let icon_size = (GetSystemMetrics(SM_CXSMICON) as i32).clamp(16, 48);
        let icon_prev = create_media_icon("prev", icon_size).map_err(|e| e.to_string())?;
        let icon_play = create_media_icon("play", icon_size).map_err(|e| e.to_string())?;
        let icon_pause = create_media_icon("pause", icon_size).map_err(|e| e.to_string())?;
        let icon_next = create_media_icon("next", icon_size).map_err(|e| e.to_string())?;

        let mut btn_prev = THUMBBUTTON {
            dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
            iId: ID_THUMBBUTTON_PREV,
            iBitmap: 0,
            hIcon: icon_prev,
            szTip: [0; 260],
            dwFlags: THBF_ENABLED,
        };
        copy_to_sz_tip("Previous Track", &mut btn_prev.szTip);

        let mut btn_play = THUMBBUTTON {
            dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
            iId: ID_THUMBBUTTON_PLAY_PAUSE,
            iBitmap: 0,
            hIcon: icon_play,
            szTip: [0; 260],
            dwFlags: THBF_ENABLED,
        };
        copy_to_sz_tip("Play", &mut btn_play.szTip);

        let mut btn_next = THUMBBUTTON {
            dwMask: THB_ICON | THB_TOOLTIP | THB_FLAGS,
            iId: ID_THUMBBUTTON_NEXT,
            iBitmap: 0,
            hIcon: icon_next,
            szTip: [0; 260],
            dwFlags: THBF_ENABLED,
        };
        copy_to_sz_tip("Next Track", &mut btn_next.szTip);

        let buttons = [btn_prev, btn_play, btn_next];

        taskbar
            .ThumbBarAddButtons(hwnd, &buttons)
            .map_err(|e| format!("ThumbBarAddButtons failed: {}", e))?;

        if let Ok(mut guard) = TASKBAR_RES.lock() {
            *guard = Some(TaskbarResources {
                taskbar,
                icon_prev,
                icon_play,
                icon_pause,
                icon_next,
            });
        }
    }

    Ok(())
}

pub fn update_taskbar_play_state(is_playing: bool) {
    IS_PLAYING.store(is_playing, Ordering::Relaxed);
    if let Some(&hwnd_val) = GLOBAL_HWND.get() {
        unsafe {
            let _ = PostMessageW(
                HWND(hwnd_val as *mut _),
                WM_UPDATE_PLAY_STATE,
                WPARAM(if is_playing { 1 } else { 0 }),
                LPARAM(0),
            );
        }
    }
}

pub fn set_taskbar_playback_state(is_playing: bool) {
    update_taskbar_play_state(is_playing);
}
