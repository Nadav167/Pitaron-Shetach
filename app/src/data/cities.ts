import type { LocalizedText } from "@/types/campsite";

/**
 * Towns the search bar recognises, so that typing "חיפה" lists the sites
 * around Haifa rather than only the sites with "חיפה" in their text.
 *
 * ACCURACY: the coordinates are approximate town centres, rounded to about
 * a kilometre. That is enough for their only use — measuring a radius of
 * tens of kilometres around the town. They are never shown on the map and
 * never handed to a navigation app, so the "no guessed coordinates" rule
 * that applies to campsites (see types/campsite.ts) is not being bent here.
 * Do not reuse them for anything that needs a real location.
 *
 * `aliases` holds other spellings people actually type.
 */
export type City = {
  name: LocalizedText;
  aliases?: string[];
  lat: number;
  lng: number;
};

export const CITIES: City[] = [
  // North
  { name: { he: "מטולה", en: "Metula" }, lat: 33.28, lng: 35.58 },
  { name: { he: "קריית שמונה", en: "Kiryat Shmona" }, aliases: ["קרית שמונה", "kiryat shmona", "qiryat shemona"], lat: 33.21, lng: 35.57 },
  { name: { he: "מג'דל שמס", en: "Majdal Shams" }, lat: 33.27, lng: 35.77 },
  { name: { he: "קצרין", en: "Katzrin" }, aliases: ["qatsrin", "katsrin"], lat: 32.99, lng: 35.69 },
  { name: { he: "צפת", en: "Safed" }, aliases: ["tzfat", "zefat", "tsfat"], lat: 32.97, lng: 35.5 },
  { name: { he: "ראש פינה", en: "Rosh Pinna" }, aliases: ["rosh pina"], lat: 32.97, lng: 35.54 },
  { name: { he: "נהריה", en: "Nahariya" }, aliases: ["נהרייה", "nahariyya"], lat: 33.01, lng: 35.09 },
  { name: { he: "מעלות-תרשיחא", en: "Ma'alot-Tarshiha" }, aliases: ["מעלות", "maalot"], lat: 33.02, lng: 35.27 },
  { name: { he: "עכו", en: "Acre" }, aliases: ["akko", "acco"], lat: 32.93, lng: 35.08 },
  { name: { he: "כרמיאל", en: "Karmiel" }, aliases: ["carmiel"], lat: 32.92, lng: 35.3 },
  { name: { he: "סח'נין", en: "Sakhnin" }, lat: 32.86, lng: 35.3 },
  { name: { he: "שפרעם", en: "Shefa-Amr" }, aliases: ["shfaram", "shefaram"], lat: 32.81, lng: 35.17 },
  { name: { he: "טבריה", en: "Tiberias" }, aliases: ["tveria", "tverya"], lat: 32.79, lng: 35.53 },
  { name: { he: "חיפה", en: "Haifa" }, lat: 32.8, lng: 34.99 },
  { name: { he: "קריית ביאליק", en: "Kiryat Bialik" }, aliases: ["קרית ביאליק"], lat: 32.83, lng: 35.08 },
  { name: { he: "נשר", en: "Nesher" }, lat: 32.77, lng: 35.04 },
  { name: { he: "טירת כרמל", en: "Tirat Carmel" }, lat: 32.76, lng: 34.97 },
  { name: { he: "קריית טבעון", en: "Kiryat Tiv'on" }, aliases: ["קרית טבעון", "טבעון", "tivon"], lat: 32.72, lng: 35.13 },
  { name: { he: "נצרת", en: "Nazareth" }, lat: 32.7, lng: 35.3 },
  { name: { he: "נוף הגליל", en: "Nof HaGalil" }, aliases: ["נצרת עילית"], lat: 32.71, lng: 35.33 },
  { name: { he: "מגדל העמק", en: "Migdal HaEmek" }, lat: 32.68, lng: 35.24 },
  { name: { he: "יקנעם", en: "Yokneam" }, aliases: ["יוקנעם", "yoqneam"], lat: 32.66, lng: 35.11 },
  { name: { he: "עפולה", en: "Afula" }, lat: 32.61, lng: 35.29 },
  { name: { he: "בית שאן", en: "Beit She'an" }, aliases: ["beit shean", "bet shean"], lat: 32.5, lng: 35.5 },
  { name: { he: "אום אל-פחם", en: "Umm al-Fahm" }, aliases: ["אום אל פחם"], lat: 32.52, lng: 35.15 },
  { name: { he: "זכרון יעקב", en: "Zikhron Ya'akov" }, aliases: ["זיכרון יעקב", "zichron yaakov", "zichron"], lat: 32.57, lng: 34.95 },
  // Center
  { name: { he: "קיסריה", en: "Caesarea" }, lat: 32.5, lng: 34.9 },
  { name: { he: "אור עקיבא", en: "Or Akiva" }, lat: 32.51, lng: 34.92 },
  { name: { he: "חדרה", en: "Hadera" }, lat: 32.44, lng: 34.92 },
  { name: { he: "נתניה", en: "Netanya" }, aliases: ["natanya"], lat: 32.33, lng: 34.86 },
  { name: { he: "רעננה", en: "Ra'anana" }, aliases: ["raanana"], lat: 32.18, lng: 34.87 },
  { name: { he: "כפר סבא", en: "Kfar Saba" }, aliases: ["kfar sava"], lat: 32.18, lng: 34.91 },
  { name: { he: "הוד השרון", en: "Hod HaSharon" }, lat: 32.15, lng: 34.89 },
  { name: { he: "הרצליה", en: "Herzliya" }, aliases: ["hertzliya", "herzlia"], lat: 32.17, lng: 34.84 },
  { name: { he: "ראש העין", en: "Rosh HaAyin" }, lat: 32.1, lng: 34.95 },
  { name: { he: "פתח תקווה", en: "Petah Tikva" }, aliases: ["פתח תקוה", "petach tikva"], lat: 32.09, lng: 34.89 },
  { name: { he: "בני ברק", en: "Bnei Brak" }, lat: 32.08, lng: 34.83 },
  { name: { he: "רמת גן", en: "Ramat Gan" }, lat: 32.07, lng: 34.82 },
  { name: { he: "תל אביב", en: "Tel Aviv" }, aliases: ["תל אביב יפו", "יפו", "jaffa", "tlv"], lat: 32.08, lng: 34.78 },
  { name: { he: "חולון", en: "Holon" }, lat: 32.01, lng: 34.78 },
  { name: { he: "בת ים", en: "Bat Yam" }, lat: 32.02, lng: 34.75 },
  { name: { he: "ראשון לציון", en: "Rishon LeZion" }, aliases: ["ראשלצ", "rishon"], lat: 31.96, lng: 34.8 },
  { name: { he: "לוד", en: "Lod" }, lat: 31.95, lng: 34.89 },
  { name: { he: "רמלה", en: "Ramla" }, aliases: ["ramle"], lat: 31.93, lng: 34.87 },
  { name: { he: "רחובות", en: "Rehovot" }, lat: 31.9, lng: 34.81 },
  { name: { he: "יבנה", en: "Yavne" }, lat: 31.88, lng: 34.74 },
  { name: { he: "מודיעין", en: "Modi'in" }, aliases: ["modiin"], lat: 31.9, lng: 35.01 },
  // Jerusalem area
  { name: { he: "ירושלים", en: "Jerusalem" }, lat: 31.78, lng: 35.22 },
  { name: { he: "בית שמש", en: "Beit Shemesh" }, aliases: ["bet shemesh"], lat: 31.75, lng: 34.99 },
  // South
  { name: { he: "אשדוד", en: "Ashdod" }, lat: 31.8, lng: 34.65 },
  { name: { he: "קריית מלאכי", en: "Kiryat Malakhi" }, aliases: ["קרית מלאכי"], lat: 31.73, lng: 34.75 },
  { name: { he: "אשקלון", en: "Ashkelon" }, lat: 31.67, lng: 34.57 },
  { name: { he: "קריית גת", en: "Kiryat Gat" }, aliases: ["קרית גת"], lat: 31.61, lng: 34.77 },
  { name: { he: "שדרות", en: "Sderot" }, lat: 31.52, lng: 34.6 },
  { name: { he: "נתיבות", en: "Netivot" }, lat: 31.42, lng: 34.59 },
  { name: { he: "אופקים", en: "Ofakim" }, lat: 31.31, lng: 34.62 },
  { name: { he: "באר שבע", en: "Beer Sheva" }, aliases: ["בארשבע", "beersheba", "beer sheba", "beersheva"], lat: 31.25, lng: 34.79 },
  { name: { he: "ערד", en: "Arad" }, lat: 31.26, lng: 35.21 },
  { name: { he: "עין גדי", en: "Ein Gedi" }, lat: 31.45, lng: 35.38 },
  { name: { he: "עין בוקק", en: "Ein Bokek" }, lat: 31.2, lng: 35.36 },
  { name: { he: "דימונה", en: "Dimona" }, lat: 31.07, lng: 35.03 },
  { name: { he: "ירוחם", en: "Yeruham" }, aliases: ["yerucham"], lat: 30.99, lng: 34.93 },
  { name: { he: "שדה בוקר", en: "Sde Boker" }, lat: 30.87, lng: 34.79 },
  { name: { he: "מצפה רמון", en: "Mitzpe Ramon" }, aliases: ["mitspe ramon"], lat: 30.61, lng: 34.8 },
  { name: { he: "אילת", en: "Eilat" }, aliases: ["elat"], lat: 29.56, lng: 34.95 },
];
