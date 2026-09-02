import {
  LeadSource,
  LeadStatus,
  LeadTemperature,
  MessageDirection,
  MessageStatus,
  MessageType,
  SubscriptionPlan,
  TaskStatus,
  UserRole,
} from "./enums";

export interface OrganizationDto {
  id: string;
  name: string;
  gstin?: string | null;
  plan: SubscriptionPlan;
  whatsappPhoneNumberId?: string | null;
  createdAt: string;
}

export interface UserDto {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface PipelineStageSummaryDto {
  id: string;
  name: string;
  order: number;
  isClosed: boolean;
}

export interface UserSummaryDto {
  id: string;
  name: string;
}

export interface LeadDto {
  id: string;
  organizationId: string;
  assignedToId?: string | null;
  assignedTo?: UserSummaryDto | null;
  pipelineStageId?: string | null;
  pipelineStage?: PipelineStageSummaryDto | null;
  name: string;
  companyName?: string | null;
  phone: string;
  email?: string | null;
  source: LeadSource;
  status: LeadStatus;
  score: number; // 0-100, AI lead scoring per PRD §6
  temperature: LeadTemperature;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStageDto {
  id: string;
  organizationId: string;
  name: string;
  order: number;
  isClosed: boolean;
}

export interface PipelineBoardStageDto extends PipelineStageDto {
  leads: LeadDto[];
}

export interface LeadSummaryDto {
  id: string;
  name: string;
  companyName?: string | null;
}

export interface TaskDto {
  id: string;
  organizationId: string;
  leadId?: string | null;
  lead?: LeadSummaryDto | null;
  assignedToId: string;
  assignedTo: UserSummaryDto;
  title: string;
  notes?: string | null;
  dueAt: string;
  status: TaskStatus;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardOverviewDto {
  totalLeads: number;
  totalCustomers: number;
  leadsByStatus: Partial<Record<LeadStatus, number>>;
  leadsByTemperature: Partial<Record<LeadTemperature, number>>;
  tasksPending: number;
  tasksCompleted: number;
  tasksOverdue: number;
}

export interface SalespersonPerformanceDto {
  user: { id: string; name: string; role: UserRole };
  leadsAssigned: number;
  leadsWon: number;
  leadsLost: number;
  tasksPending: number;
  tasksCompleted: number;
  tasksOverdue: number;
}

export interface CustomerSummaryDto {
  id: string;
  name: string;
  companyName?: string | null;
}

export interface MessageDto {
  id: string;
  organizationId: string;
  conversationId: string;
  direction: MessageDirection;
  type: MessageType;
  body: string;
  status: MessageStatus;
  externalId?: string | null;
  templateName?: string | null;
  // Present when type != TEXT. mediaProviderId-backed media is fetched via
  // GET /whatsapp/media/:messageId; mediaUrl is a direct link (dev/stub-provider sends).
  mediaUrl?: string | null;
  mediaProviderId?: string | null;
  mediaMimeType?: string | null;
  sentById?: string | null;
  sentBy?: UserSummaryDto | null;
  createdAt: string;
}

export interface ConversationDto {
  id: string;
  organizationId: string;
  phone: string;
  leadId?: string | null;
  lead?: LeadSummaryDto | null;
  customerId?: string | null;
  customer?: CustomerSummaryDto | null;
  lastMessageAt: string;
  /** Null until the customer has replied at least once — see the 24h session window rule. */
  lastInboundMessageAt?: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: MessageDto[]; // present as a 1-item "last message" preview on list responses
}

export interface MessageTemplateDto {
  id: string;
  organizationId: string;
  name: string;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
