// Shared enums used by both apps/web and apps/api. Mirrors PRD §4 core modules.

export enum UserRole {
  ADMIN = "ADMIN",
  OWNER = "OWNER",
  SALES_MANAGER = "SALES_MANAGER",
  SALES_EXECUTIVE = "SALES_EXECUTIVE",
  FIELD_SALES_EXECUTIVE = "FIELD_SALES_EXECUTIVE",
}

export enum LeadSource {
  WHATSAPP = "WHATSAPP",
  WEBSITE_FORM = "WEBSITE_FORM",
  INDIAMART = "INDIAMART",
  JUSTDIAL = "JUSTDIAL",
  META_ADS = "META_ADS",
  GOOGLE_ADS = "GOOGLE_ADS",
  REFERRAL = "REFERRAL",
  MANUAL = "MANUAL",
  IMPORT = "IMPORT",
}

export enum LeadTemperature {
  HOT = "HOT",
  WARM = "WARM",
  COLD = "COLD",
}

export enum LeadStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  QUALIFIED = "QUALIFIED",
  QUOTATION_SENT = "QUOTATION_SENT",
  NEGOTIATION = "NEGOTIATION",
  WON = "WON",
  LOST = "LOST",
}

export enum SubscriptionPlan {
  FREE_TRIAL = "FREE_TRIAL",
  STARTER = "STARTER",
  BUSINESS = "BUSINESS",
  PROFESSIONAL = "PROFESSIONAL",
  ENTERPRISE = "ENTERPRISE",
}

export enum TaskStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
}

export enum MessageDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
}

export enum MessageType {
  TEXT = "TEXT",
  IMAGE = "IMAGE",
  DOCUMENT = "DOCUMENT",
  AUDIO = "AUDIO",
  VIDEO = "VIDEO",
}

export enum MessageStatus {
  QUEUED = "QUEUED",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ",
  FAILED = "FAILED",
}

export enum QuotationStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
}
