// GWA Security - Audit Logger
// Per spec: "Audit log immutable toutes operations sensibles."

import { createClient } from "@/lib/supabase/server"
import { headers } from "next/headers"

export type AuditAction = 
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "auth.otp_request"
  | "auth.password_reset"
  | "user.profile_update"
  | "user.kyc_submit"
  | "user.kyc_verified"
  | "user.kyc_rejected"
  | "product.create"
  | "product.update"
  | "product.delete"
  | "order.create"
  | "order.update"
  | "order.cancel"
  | "payment.initiated"
  | "payment.success"
  | "payment.failed"
  | "payment.refund"
  | "wallet.deposit"
  | "wallet.withdraw"
  | "message.send"
  | "review.create"
  | "admin.user_ban"
  | "admin.user_unban"
  | "admin.listing_remove"
  | "admin.config_change"
  | "security.rate_limit_exceeded"
  | "security.suspicious_activity"

export type AuditSeverity = "info" | "warning" | "critical"

interface AuditLogEntry {
  action: AuditAction
  user_id?: string
  target_id?: string
  target_type?: string
  metadata?: Record<string, any>
  ip_address?: string
  user_agent?: string
  severity?: AuditSeverity
}

// Determine severity based on action
function getSeverity(action: AuditAction): AuditSeverity {
  if (action.startsWith("security.") || action.includes("failed") || action.includes("ban")) {
    return "warning"
  }
  if (action.startsWith("admin.") || action.includes("kyc") || action.includes("payment")) {
    return "critical"
  }
  return "info"
}

// Log to audit_logs table
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const headersList = await headers()
    
    const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               headersList.get("x-real-ip") ||
               headersList.get("cf-connecting-ip") ||
               "unknown"
    
    const userAgent = headersList.get("user-agent") || "unknown"
    
    const severity = entry.severity || getSeverity(entry.action)
    
    const supabase = await createClient()
    
    // Insert into audit_logs table
    const { error } = await supabase.from("audit_logs").insert({
      action: entry.action,
      user_id: entry.user_id || null,
      target_id: entry.target_id || null,
      target_type: entry.target_type || null,
      metadata: entry.metadata || {},
      ip_address: ip,
      user_agent: userAgent,
      severity,
      created_at: new Date().toISOString(),
    })
    
    if (error) {
      // Log to console if DB insert fails (backup)
      console.error("[AUDIT LOG ERROR]", error)
      console.log("[AUDIT LOG BACKUP]", JSON.stringify({
        ...entry,
        ip_address: ip,
        user_agent: userAgent,
        severity,
        timestamp: new Date().toISOString(),
      }))
    }
    
    // For critical events, we could also send alerts
    if (severity === "critical") {
      // In production, send to monitoring service (Datadog, Sentry, etc.)
      console.warn("[CRITICAL AUDIT EVENT]", entry.action, entry.metadata)
    }
    
  } catch (err) {
    // Never throw from audit log - fail silently but log
    console.error("[AUDIT LOG EXCEPTION]", err)
  }
}

// Convenience functions for common audit events
export const audit = {
  // Auth events
  loginSuccess: (userId: string) => 
    auditLog({ action: "auth.login", user_id: userId }),
  
  loginFailed: (email: string, reason: string) => 
    auditLog({ action: "auth.login_failed", metadata: { email, reason }, severity: "warning" }),
  
  logout: (userId: string) => 
    auditLog({ action: "auth.logout", user_id: userId }),
  
  // Payment events
  paymentInitiated: (userId: string, orderId: string, amount: number, provider: string) =>
    auditLog({ 
      action: "payment.initiated", 
      user_id: userId, 
      target_id: orderId, 
      target_type: "order",
      metadata: { amount, provider },
    }),
  
  paymentSuccess: (userId: string, orderId: string, transactionId: string, amount: number) =>
    auditLog({ 
      action: "payment.success", 
      user_id: userId, 
      target_id: orderId, 
      target_type: "order",
      metadata: { transactionId, amount },
    }),
  
  paymentFailed: (userId: string, orderId: string, reason: string) =>
    auditLog({ 
      action: "payment.failed", 
      user_id: userId, 
      target_id: orderId, 
      target_type: "order",
      metadata: { reason },
      severity: "warning",
    }),
  
  // Security events
  rateLimitExceeded: (endpoint: string, clientId: string) =>
    auditLog({ 
      action: "security.rate_limit_exceeded", 
      metadata: { endpoint, clientId },
      severity: "warning",
    }),
  
  suspiciousActivity: (userId: string | undefined, reason: string, details: Record<string, any>) =>
    auditLog({ 
      action: "security.suspicious_activity", 
      user_id: userId,
      metadata: { reason, ...details },
      severity: "critical",
    }),
  
  // KYC events
  kycSubmitted: (userId: string, documentType: string) =>
    auditLog({ 
      action: "user.kyc_submit", 
      user_id: userId,
      metadata: { documentType },
    }),
  
  // Admin events
  adminAction: (adminId: string, action: AuditAction, targetId: string, targetType: string, details?: Record<string, any>) =>
    auditLog({
      action,
      user_id: adminId,
      target_id: targetId,
      target_type: targetType,
      metadata: { admin: true, ...details },
      severity: "critical",
    }),
}
