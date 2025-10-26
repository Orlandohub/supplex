# Integration Test Scenarios - Story 2.8: Email Notification System

## Test Environment Setup

- **Backend**: Running on localhost:3001
- **Frontend**: Running on localhost:3000
- **Redis**: Configured via REDIS_URL (Upstash)
- **Resend**: Configured via RESEND_API_KEY
- **Database**: PostgreSQL with migrations applied

## Scenario 1: Send Workflow Submitted Email (End-to-End)

**Objective**: Verify that submitting a workflow triggers an email notification to the assigned reviewer.

**Steps**:
1. Login as Procurement Manager
2. Create a new workflow for a supplier
3. Upload all required documents
4. Submit the workflow for Stage 1 review
5. Check that:
   - Workflow status changes to "Stage1"
   - Email notification record is created in `email_notifications` table with status "pending"
   - BullMQ job is queued
   - Email worker processes the job
   - Email is sent via Resend (check email inbox)
   - `email_notifications` record status updates to "sent"

**Expected Result**:
- Reviewer receives email with subject: "Action Required: [Supplier Name] Qualification"
- Email contains workflow link, supplier name, initiator name, risk score
- Email has unsubscribe link

**SQL Queries for Verification**:
```sql
-- Check email notification record
SELECT * FROM email_notifications 
WHERE event_type = 'workflow_submitted' 
ORDER BY created_at DESC LIMIT 1;

-- Check user preferences (should default to enabled)
SELECT * FROM user_notification_preferences 
WHERE user_id = '[reviewer_id]' AND event_type = 'workflow_submitted';
```

---

## Scenario 2: User Opts Out of Email Notifications

**Objective**: Verify that users can disable specific email notifications and no longer receive them.

**Steps**:
1. Login as Quality Manager
2. Navigate to Settings > Email Notifications
3. Disable "Stage Approved" notifications
4. Have another user approve a stage where this user is the initiator
5. Check that:
   - User preference is saved in database with `email_enabled = false`
   - No email notification record is created
   - No email is sent

**Expected Result**:
- User does not receive "Stage Approved" email
- `email_notifications` table does not have a new record for this event

**SQL Queries for Verification**:
```sql
-- Verify user preference
SELECT * FROM user_notification_preferences 
WHERE user_id = '[user_id]' AND event_type = 'stage_approved';
-- Expected: email_enabled = false

-- Verify no email sent
SELECT COUNT(*) FROM email_notifications 
WHERE user_id = '[user_id]' 
AND event_type = 'stage_approved' 
AND created_at > '[test_start_time]';
-- Expected: 0
```

---

## Scenario 3: Tenant Disables Email Notifications Globally

**Objective**: Verify that tenant-level settings override user preferences.

**Steps**:
1. Login as Admin
2. Navigate to Admin > Email Settings
3. Disable "Workflow Submitted" notifications for entire tenant
4. Have a Procurement Manager submit a workflow
5. Check that:
   - Tenant settings are updated in `tenants.settings.emailNotifications`
   - No email is sent, even if user preferences are enabled

**Expected Result**:
- No email notification is queued or sent
- All users in tenant are affected by this setting

**SQL Queries for Verification**:
```sql
-- Verify tenant setting
SELECT settings->'emailNotifications'->>'workflowSubmitted' AS enabled 
FROM tenants WHERE id = '[tenant_id]';
-- Expected: 'false'

-- Verify no email sent
SELECT COUNT(*) FROM email_notifications 
WHERE tenant_id = '[tenant_id]' 
AND event_type = 'workflow_submitted' 
AND created_at > '[test_start_time]';
-- Expected: 0
```

---

## Scenario 4: Email Send Fails and Retries 3 Times

**Objective**: Verify that failed emails are retried with exponential backoff.

**Steps**:
1. Temporarily misconfigure RESEND_API_KEY (use invalid key)
2. Trigger a workflow submission
3. Observe BullMQ worker logs
4. Check that:
   - Email notification status is "pending" initially
   - Worker attempts to send 3 times (1 min, 5 min, 15 min delays)
   - After 3 failures, status changes to "failed"
   - `attempt_count` is 3
   - `failed_reason` contains error message

**Expected Result**:
- Email is NOT sent
- `email_notifications` record shows status "failed" with attempt_count = 3
- Error is logged in `failed_reason` field

**SQL Queries for Verification**:
```sql
-- Check failed email
SELECT id, status, attempt_count, failed_reason, sent_at 
FROM email_notifications 
WHERE status = 'failed' 
ORDER BY created_at DESC LIMIT 1;
-- Expected: status = 'failed', attempt_count = 3, sent_at = NULL
```

---

## Scenario 5: Rate Limiting Prevents Spam (11th Email in 1 Hour)

**Objective**: Verify that users cannot send more than 10 emails per hour.

**Steps**:
1. Simulate 10 workflow submissions in quick succession for the same reviewer
2. Attempt an 11th submission within the same hour
3. Check that:
   - First 10 emails are queued and sent
   - 11th email is NOT queued (rate limit exceeded)
   - Redis key `email_rate_limit:[user_id]:[hour]` has value 10

**Expected Result**:
- First 10 emails are sent successfully
- 11th email is skipped with rate limit log message
- No error is thrown (graceful handling)

**Redis Verification**:
```bash
# Check rate limit counter
redis-cli GET email_rate_limit:[user_id]:[current_hour]
# Expected: 10
```

---

## Scenario 6: Admin Views Email Logs with Filters

**Objective**: Verify that admins can view and filter email notification logs.

**Steps**:
1. Login as Admin
2. Navigate to Admin > Email Logs
3. View all email logs (default: last 30 days)
4. Filter by status "failed"
5. Filter by date range (last 7 days)
6. Filter by specific user
7. Paginate through results

**Expected Result**:
- Email logs are displayed in table with columns: Event Type, Recipient, Subject, Status, Sent At, Attempts, Error
- Filters work correctly
- Pagination shows 50 results per page
- Only emails from the tenant are visible (tenant isolation)

**API Endpoint Test**:
```bash
# Get email logs
curl -H "Authorization: Bearer [admin_token]" \
  http://localhost:3001/api/admin/email-logs?status=sent&page=1&limit=50
```

---

## Scenario 7: User Unsubscribes via Unsubscribe Link

**Objective**: Verify that clicking unsubscribe link disables notifications for specific event type.

**Steps**:
1. User receives an email with unsubscribe link
2. Click unsubscribe link (format: `/api/unsubscribe/[token]`)
3. User sees confirmation page: "You have been unsubscribed from [Event Type] notifications"
4. Check that:
   - User preference is created/updated with `email_enabled = false`
   - `unsubscribed_at` timestamp is set
   - Future emails of that type are not sent to this user

**Expected Result**:
- User sees success page
- Preference is saved in database
- User no longer receives emails for that event type

**SQL Queries for Verification**:
```sql
-- Verify unsubscribe
SELECT email_enabled, unsubscribed_at 
FROM user_notification_preferences 
WHERE user_id = '[user_id]' AND event_type = '[event_type]';
-- Expected: email_enabled = false, unsubscribed_at = [timestamp]
```

---

## Scenario 8: Email Preferences Save Correctly

**Objective**: Verify that user can save notification preferences via settings page.

**Steps**:
1. Login as any user
2. Navigate to Settings > Email Notifications
3. Disable "Stage Rejected" notifications
4. Enable "Workflow Approved" notifications (if disabled)
5. Click Save
6. Refresh page and verify settings persist
7. Check database for updated preferences

**Expected Result**:
- Settings are saved successfully
- Toast notification: "Notification preferences updated"
- Preferences persist across page refreshes

**API Endpoint Test**:
```bash
# Update preference
curl -X PUT -H "Authorization: Bearer [user_token]" \
  -H "Content-Type: application/json" \
  -d '{"eventType":"stage_rejected","emailEnabled":false}' \
  http://localhost:3001/api/users/me/notification-preferences
```

---

## Performance Tests

### Test 1: Email Queue Throughput
- **Objective**: Verify that 100 emails can be queued and processed within 5 minutes
- **Method**: Submit 100 workflows in quick succession
- **Expected**: All emails queued and processed successfully

### Test 2: Rate Limiter Performance
- **Objective**: Verify Redis rate limiting handles high concurrency
- **Method**: 50 concurrent requests for same user
- **Expected**: Rate limiter correctly counts and blocks after 10 emails

---

## Regression Tests

### Test 1: Existing Workflow Routes Still Work
- **Objective**: Verify that adding email notifications doesn't break workflow submission/approval
- **Scenarios**: Submit workflow, approve stage, reject stage
- **Expected**: All workflows complete successfully with or without email service

### Test 2: Tenant Isolation
- **Objective**: Verify that email logs and preferences are tenant-isolated
- **Method**: Login as users from different tenants
- **Expected**: Each user only sees their tenant's data

---

## Edge Cases

### Case 1: Invalid Email Address
- **Test**: Submit workflow with reviewer having invalid email
- **Expected**: Email marked as "failed" with error "Invalid email address"

### Case 2: Missing Environment Variables
- **Test**: Start server without RESEND_API_KEY
- **Expected**: Emails gracefully fail with "Email service not configured"

### Case 3: Redis Connection Failure
- **Test**: Disconnect Redis during email queueing
- **Expected**: Error is logged but workflow submission succeeds

### Case 4: Expired Unsubscribe Token
- **Test**: Use unsubscribe link after 90 days
- **Expected**: Show error page: "This unsubscribe link has expired"

---

## Manual Testing Checklist

- [ ] Send workflow submitted email (check inbox)
- [ ] Send stage approved email (check inbox)
- [ ] Send stage rejected email (check inbox)
- [ ] Send workflow approved email to supplier (check inbox)
- [ ] Verify email templates render correctly on mobile and desktop
- [ ] Test unsubscribe link (click and verify)
- [ ] Test email preferences page (toggle on/off)
- [ ] Test admin email settings page (tenant-wide)
- [ ] Test admin email logs page (filtering and pagination)
- [ ] Verify rate limiting (send 11+ emails in 1 hour)
- [ ] Verify tenant isolation (multi-tenant test)
- [ ] Check BullMQ dashboard for queued/failed jobs
- [ ] Monitor Resend dashboard for delivery stats

---

## Test Data Requirements

- **Tenants**: At least 2 tenants for isolation testing
- **Users**: Admin, Procurement Manager, Quality Manager in each tenant
- **Suppliers**: At least 3 suppliers with valid contact emails
- **Workflows**: At least 10 workflows in various states
- **Email Addresses**: Use test email addresses (e.g., mailtrap.io or real inboxes)

---

## Automation Candidates

High-priority tests for automation (Playwright E2E):
1. Scenario 1: End-to-end workflow submission with email
2. Scenario 2: User opts out and verifies no email received
3. Scenario 6: Admin views and filters email logs
4. Scenario 7: Unsubscribe link workflow

---

## Notes

- **Email Delivery Time**: Allow 1-2 minutes for emails to be processed by BullMQ worker
- **Resend Rate Limits**: Resend has rate limits (check dashboard for limits)
- **Redis TTL**: Rate limit keys expire after 1 hour automatically
- **Database Cleanup**: Clean up test email notifications after testing to avoid clutter

---

**Last Updated**: October 25, 2025  
**Story**: 2.8 - Email Notification System  
**Status**: Ready for QA

