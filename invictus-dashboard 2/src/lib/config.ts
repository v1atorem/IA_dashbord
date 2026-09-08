// Конфигурация и дефолты. Всё, что помечено (setting), можно переопределить
// в таблице Setting через UI без изменения кода.

export const DIRECTIONS = ["ГП", "ТЗ", "Буст+", "Казахский"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const UNKNOWN = "Непонятно пока";

// Какие направления разбиваем по городам в сводке (setting)
export const DEFAULT_SPLIT_BY_CITY: Record<string, boolean> = {
  "ГП": true,
  "ТЗ": true,
  "Буст+": false,
  "Казахский": false,
};

// Разрешённые города по направлению (справочно; сводка строит строки по факту)
export const DIRECTION_CITIES: Record<string, string[]> = {
  "ГП": ["Алматы", "Астана"],
  "ТЗ": ["Алматы", "Астана", "Шымкент", "Караганда"],
  "Казахский": ["Алматы", "Шымкент"],
  "Буст+": [],
};

// Стадии, считающиеся квалом (setting: qualStages)
export const DEFAULT_QUAL_STAGES = [
  "Оффер озвучен + дедлайн",
  "Наработка",
  "Счет выставлен",
  "Отказ банка",
  "Ответилил на рассылку",
  "предоплата / тРАНШЕВАЯ ОПЛАТА",
  "предоплата получена",
  "Успешно реализовано",
  "Закрыто и не реализовано (Дорого (не смог продать))",
  "Закрыто и не реализовано (Пропала потребность)",
  "Закрыто и не реализовано (В следующий раз)",
  "Закрыто и не реализовано (Гасится)",
  "Закрыто и не реализовано (Выбрали других)",
  "Закрыто и не реализовано (Отказ рассрочки от банка)",
];

// Стадии, считающиеся продажей (setting: saleStages)
export const DEFAULT_SALE_STAGES = [
  "Успешно реализовано",
  "предоплата / тРАНШЕВАЯ ОПЛАТА",
];

// Курс USD→KZT по умолчанию (setting: usdToKzt); ENV имеет приоритет над дефолтом
export const DEFAULT_USD_TO_KZT = Number(process.env.USD_TO_KZT || "465");

// amoCRM: имена кастомных полей, которые ищем в сделке (маппинг по имени, не по ID)
export const AMO_FIELD_NAMES = {
  city: ["Город?", "ГОРОД", "ГОРОД_ПРОЖИВАНИЯ"],
  course: ["Курс"],
  formName: ["FORMNAME", "form_name"],
  utmSource: ["utm_source"],
  utmMedium: ["utm_medium"],
  utmCampaign: ["utm_campaign"],
  utmContent: ["utm_content"],
};

export const env = {
  amoSubdomain: process.env.AMO_SUBDOMAIN || "",
  amoToken: process.env.AMO_ACCESS_TOKEN || "",
  amoPipelineId: process.env.AMO_PIPELINE_ID || "",
  fbToken: process.env.FB_ACCESS_TOKEN || "",
  fbAccounts: (process.env.FB_AD_ACCOUNT_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  fbApiVersion: process.env.FB_API_VERSION || "v21.0",
  cronSecret: process.env.CRON_SECRET || "",
};
