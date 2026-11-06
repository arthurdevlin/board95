# Board95 email activation, step by step

The application already sends through Resend using src/lib/email.ts. No SMTP package is required. These instructions cover outbound notifications and password reset; receiving replies and signup verification are separate features.

## 1. Choose a setup path

For a first test without a domain, create or sign in to a Resend account and use `Board95 <onboarding@resend.dev>` as the sender. This testing sender can send only to the email address associated with that Resend account. Use a controlled Board95 account with that address for testing; other recipients will fail.

For real customers, use a domain you own. Add a sending subdomain such as `notifications.example.com` in Resend Domains. Add the exact DNS records Resend supplies at your DNS provider, then wait until Resend shows the domain as verified. Preserve existing mailbox DNS records. Use the actual verified domain in the sender address.

## 2. Create an API key

In Resend API Keys, create a key named Board95 with Sending access. For production, restrict it to the verified sending domain. Store it directly in your local environment file and hosting environment settings; do not paste it into chat or commit it.

## 3. Configure Board95

Set these variables in the root `.env` for local development and separately in the deployment environment:

```dotenv
RESEND_API_KEY="YOUR_PRIVATE_RESEND_KEY"
RESEND_FROM_EMAIL="Board95 <notifications@notifications.example.com>"
BOARD95_ADMIN_EMAIL="YOUR_ADMIN_INBOX"
BETTER_AUTH_URL="https://YOUR_PUBLIC_APP_ORIGIN"
```

For local testing, keep BETTER_AUTH_URL set to `http://localhost:3000`. For the no-domain test, replace RESEND_FROM_EMAIL with `Board95 <onboarding@resend.dev>`. The example sender/domain values above are placeholders.

Restart `npm run dev` after changing local variables. Redeploy after changing hosting variables. These variables are server secrets; do not prefix them with NEXT_PUBLIC_. Ensure migrations have been applied to the target database before testing.

## 4. Test one password reset

Use a Board95 test account whose inbox you control. Open `/forgot-password`, request a reset and inspect the message in both Resend and your inbox/spam folder. Open the HTML reset button, choose a new password and confirm sign-in succeeds. Request a fresh reset if the previous link expired. Never reuse another person's reset link.

The current plain-text email body omits the action URL; use the HTML button until that improvement is implemented. Provider acceptance is recorded as SENT, which does not establish inbox delivery.

## 5. Test notifications

Using controlled passenger/provider accounts, create one booking or rental request, then accept or decline it. Confirm the expected recipients and message references. Test application/admin notifications separately. The resend.dev test sender will reject recipients other than your Resend account address.

## 6. Review the existing queue

Open `/admin` as an administrator and expand Email delivery queue. Inspect pending/failed entries before using Retry up to 25: it attempts the oldest pending/failed messages, which may include stale reset links and historical notifications. The button performs real sends once credentials are configured. Request a fresh password reset instead of relying on old queued reset messages.

Failures show an HTTP status in the queue. Check Resend for the detailed reason, sender verification, key permissions and recipient restrictions. Do not publish provider logs containing recipients, message content or tokens.

There is currently no automatic email-retry scheduler or delivery webhook. Those are follow-up implementation tasks; do not point the mobile-notification cron at the email queue.

## References

- [Verified domains](https://resend.com/docs/dashboard/domains/introduction)
- [API keys](https://resend.com/docs/dashboard/api-keys/introduction)
- [Testing sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain)
- [Idempotency keys and the 24-hour deduplication window](https://resend.com/docs/dashboard/emails/idempotency-keys)
