package com.prism.musicplayer

import android.app.Application

class PrismApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    try {
      System.loadLibrary("c++_shared")
    } catch (e: Throwable) {
      e.printStackTrace()
    }
  }
}
