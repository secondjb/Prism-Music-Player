import { pinyin } from 'pinyin-pro';
import Aromanize from 'aromanize';

// Japanese kana to romaji dictionary map for fast offline romanization
const KANA_ROMAJI_MAP: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヲ: 'wo', ン: 'n',
};

function isJapanese(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
}

function isKorean(text: string): boolean {
  return /[\uAC00-\uD7AF\u1100-\u11FF]/.test(text);
}

function isChinese(text: string): boolean {
  return /[\u4E00-\u9FAF]/.test(text) && !isJapanese(text);
}

export function romanizeJapanese(text: string): string {
  let result = text;
  // Replace multi-char combinations
  for (const [kana, romaji] of Object.entries(KANA_ROMAJI_MAP)) {
    if (kana.length > 1 && result.includes(kana)) {
      result = result.split(kana).join(romaji);
    }
  }
  // Replace single-char kana
  for (const [kana, romaji] of Object.entries(KANA_ROMAJI_MAP)) {
    if (kana.length === 1 && result.includes(kana)) {
      result = result.split(kana).join(romaji);
    }
  }
  return result;
}

export function romanizeKorean(text: string): string {
  try {
    if (Aromanize && typeof Aromanize.toLatin === 'function') {
      return Aromanize.toLatin(text);
    }
  } catch (e) {
    // Fallback
  }
  return text;
}

export function romanizeChinese(text: string): string {
  try {
    return pinyin(text, { toneType: 'none', type: 'string' });
  } catch (e) {
    return text;
  }
}

export function romanizeText(text: string, mode: 'none' | 'romaji' | 'pinyin' | 'aromanize'): string {
  if (!text || mode === 'none') return text;

  if (mode === 'romaji' || isJapanese(text)) {
    return romanizeJapanese(text);
  }
  if (mode === 'aromanize' || isKorean(text)) {
    return romanizeKorean(text);
  }
  if (mode === 'pinyin' || isChinese(text)) {
    return romanizeChinese(text);
  }
  return text;
}
