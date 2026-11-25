# Login setup (Supabase)

Players can always play as a guest. Logging in is optional and uses email: we send a **6-digit code**
(and a link). These dashboard settings are needed once.

## 1. Allowed redirect URLs
Supabase → **Authentication → URL Configuration**
- **Site URL**: your live site (e.g. `https://playalmost.com`); for now `http://localhost:3100`
- **Redirect URLs**: add `http://localhost:3100/**` and later `https://<your-site>/**`

## 2. Put the code in the emails
Supabase → **Authentication → Emails → Templates**. In each of these templates, add the code line
(keep the existing link):

- **Magic link** (logging into an existing account)
- **Confirm signup** (first login with a new email)
- **Change email address** (a guest saving their profile with an email)

```html
<p>Your almost. code: <strong>{{ .Token }}</strong></p>
<p>Or <a href="{{ .ConfirmationURL }}">open this link</a> on the device where you asked to log in.</p>
```

## 3. Email delivery (before inviting players)
Supabase's built-in sender only delivers to your project's team members and only a few emails per hour.
For real players, set up custom SMTP: **Authentication → Emails → SMTP Settings** with any provider
(e.g. Resend, Postmark, Amazon SES). Use a sender like `hello@<your-domain>`.

## How it behaves
| Who | Enters | Result |
| --- | --- | --- |
| Guest | a new email | guest account becomes a real account — name, streak, today's game kept |
| Guest | an email that already has an account | logs into that account; the guest's games (for days the account hasn't played) move into it |
| Nobody yet | any email | creates the account (or logs in) |

Logging out returns the device to "no account"; the next game starts a fresh guest.
