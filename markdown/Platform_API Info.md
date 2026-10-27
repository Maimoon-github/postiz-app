Analyzing .env.example
Errored list social integration files
Analyzing package.json
Analyzing .env
Analyzing x.provider.ts
Analyzing facebook.provider.ts
Analyzing instagram.provider.ts
Analyzing instagram.standalone.provider.ts
Analyzing threads.provider.ts
Analyzing linkedin-page.provider.ts
Analyzing tiktok.provider.ts
Analyzing reddit.provider.ts
Analyzing pinterest.provider.ts
Analyzing docker-compose.yml
Analyzing docker-compose.yaml
Analyzing README.md
Searched docs.postiz.com for postiz providers environment variables X LinkedIn Facebook Instagram Threads TikTok Reddit Pinterest
Searched docs.postiz.com for postiz providers facebook instagram standalone threads linkedin page tiktok reddit pinterest scopes redirect uri
Searched docs.postiz.com for "instagram-standalone" OR "threads" OR "tiktok" OR "pinterest" OR "reddit" OR "x" scopes permissions postiz

Below is a step-by-step guide to obtaining developer credentials, configuring OAuth redirect URIs and scopes, formatting your Postiz `.env` file, and resolving **`Invalid App ID`** / **`Invalid Client ID`** errors across all eight social platforms.

---

## 1. Universal Prerequisite: Redirect URI Pattern

Every social integration in Postiz routes OAuth callbacks through your `FRONTEND_URL` (no trailing slash) using the pattern:

```text
{FRONTEND_URL}/integrations/social/{provider}
```

| Environment | Base `FRONTEND_URL` Example | Redirect URI Example (X) |
| :--- | :--- | :--- |
| **Production (HTTPS required by most APIs)** | `https://postiz.yourdomain.com` | `https://postiz.yourdomain.com/integrations/social/x` |
| **Docker Local Default** | `http://localhost:5000` | `http://localhost:5000/integrations/social/x` |
| **Dev Mode Local** | `http://localhost:4200` | `http://localhost:4200/integrations/social/x` |

> **Important:** Make sure `FRONTEND_URL` and `NEXT_PUBLIC_BACKEND_URL` in your `.env` do **not** have a trailing `/` at the end, or Postiz will generate double slashes (`//integrations/social/...`) and fail OAuth validation.

---

## 2. Platform-by-Platform Developer Portal Setup

### 1. X (Twitter)
Postiz uses **OAuth 1.0a Consumer Keys** (`API Key` and `API Key Secret`), **not** the OAuth 2.0 Client ID. Using the OAuth 2.0 Client ID is the #1 cause of authentication failure on X.

1. Go to the [X Developer Portal](https://developer.x.com/en/portal/dashboard) and create a **Project** and an **App**.
2. In your App settings, locate **User authentication settings** and click **Set up**:
   * **App permissions:** Select **Read and write**.
   * **Type of App:** Select **Web App, Automated App or Bot**.
   * **Callback URI / Redirect URL:**
     ```text
     {FRONTEND_URL}/integrations/social/x
     ```
   * **Website URL:** Your website or `{FRONTEND_URL}`.
3. Go to the **Keys and tokens** tab:
   * Under **Consumer Keys**, click **Regenerate** (or view) to get your **API Key** and **API Key Secret**.
   * Map these to `X_API_KEY` and `X_API_SECRET`.

---

### 2. LinkedIn & LinkedIn Page
Both Personal Profiles (`linkedin`) and Company Pages (`linkedin-page`) share the same LinkedIn Developer App and `.env` credentials, but require **two separate Redirect URLs** and the **Advertising API / Community Management** product for Page access.

1. Go to the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps) and click **Create app**.
2. Associate the app with a verified LinkedIn Company Page.
3. Open the **Products** tab and request access to:
   * **Share on LinkedIn** (Default profile posting)
   * **Sign In with LinkedIn using OpenID Connect**
   * **Advertising API** *(or Community Management API — required to unlock organization/page scopes)*
4. Open the **Auth** tab:
   * Copy your **Client ID** and **Primary Client Secret**.
   * Under **OAuth 2.0 settings -> Authorized redirect URLs for your app**, add **both** URLs:
     ```text
     {FRONTEND_URL}/integrations/social/linkedin
     {FRONTEND_URL}/integrations/social/linkedin-page
     ```
5. Verify the following OAuth 2.0 scopes are enabled on your app:
   * `openid`, `profile`, `w_member_social`, `r_basicprofile`
   * `rw_organization_admin`, `w_organization_social`, `r_organization_social`

---

### 3. Facebook (Page) & Instagram (Facebook Business Connected)
Facebook Pages (`facebook`) and Business-connected Instagram accounts (`instagram`) share the **exact same Meta App ID and Secret** (`FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`).

1. Go to [Meta for Developers](https://developers.facebook.com/apps/) and click **Create App**:
   * Select **Other** -> **Business** as the app type.
2. Inside your App Dashboard, add the **Facebook Login for Business** product.
3. In the left sidebar, go to **Facebook Login for Business -> Settings**:
   * Enable **Client OAuth Login** and **Web OAuth Login**.
   * Add **both** URLs to **Valid OAuth Redirect URIs**:
     ```text
     {FRONTEND_URL}/integrations/social/facebook
     {FRONTEND_URL}/integrations/social/instagram
     ```
4. Ensure the following permissions/scopes are added in **App Review -> Permissions and Features** (or accessible in Development Mode for admin/tester accounts):
   * **Facebook Page scopes:** `pages_show_list`, `business_management`, `pages_manage_posts`, `pages_manage_engagement`, `pages_read_engagement`, `read_insights`
   * **Instagram Business scopes:** `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`
5. Go to **App Settings -> Basic** at the top left:
   * Copy the top-level **App ID** and **App Secret** into `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`.

---

### 4. Instagram (Standalone — `instagram-standalone`)
> **Critical "Invalid App ID" Trap:** Meta uses a **sub-application ID** specifically for the Instagram API with Instagram Login. If you put your main Meta App ID into `INSTAGRAM_APP_ID`, Instagram will throw **`Invalid App ID`** or **`Invalid platform app`**.

1. In your [Meta for Developers](https://developers.facebook.com/apps/) dashboard, click **Add Product** and select **Instagram** (Instagram API with Instagram Login).
2. Navigate to **Instagram -> API setup with Instagram login** in the left sidebar.
3. Click **Set up** under **Configure Business Login settings**:
   * **OAuth redirect URIs:**
     ```text
     {FRONTEND_URL}/integrations/social/instagram-standalone
     ```
   * **Deauthorize callback URL:** `{FRONTEND_URL}`
   * **Data Deletion Request URL:** `{FRONTEND_URL}`
4. Ensure the Instagram scopes are active:
   * `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_messages`
5. **Copy the Instagram-specific credentials** displayed directly inside the **Instagram -> API setup with Instagram login** page (**Instagram App ID** and **Instagram App Secret**), **NOT** the ones in `App Settings -> Basic`.
6. Map those to `INSTAGRAM_APP_ID` and `INSTAGRAM_APP_SECRET`.

---

### 5. Threads (`threads`)
> **Critical "Invalid App ID" Trap:** Just like Instagram Standalone, Meta generates a dedicated **Threads App ID** and **Threads App Secret** inside the Threads use case settings. Using the main Meta App ID causes an **`Invalid App ID`** error.

1. In [Meta for Developers](https://developers.facebook.com/apps/), click **Create App** (or edit your existing app) and add the **Access the Threads API** use case.
2. In the left menu, go to **Use cases -> Access the Threads API -> Settings**:
   * **Redirect Callback URLs:**
     ```text
     {FRONTEND_URL}/integrations/social/threads
     ```
   * **Uninstall Callback URL:** `{FRONTEND_URL}`
   * **Delete Callback URL:** `{FRONTEND_URL}`
3. Under **Permissions**, add:
   * `threads_basic`
   * `threads_content_publish`
   * `threads_manage_replies`, `threads_read_replies`, `threads_manage_insights`
4. Under **App Roles -> Roles**, add your Threads account as a **Threads Tester** (and accept the invite in the Threads mobile/web app under *Settings -> Account -> Website permissions -> Invitations* if your app is in Development Mode).
5. Still inside **Access the Threads API -> Settings**, copy the **Threads App ID** and **Threads App Secret** and assign them to `THREADS_APP_ID` and `THREADS_APP_SECRET`.

---

### 6. TikTok (`tiktok`)
> **Critical Credential Trap:** TikTok calls its identifier a **Client Key** (alphanumeric), not the numeric App ID. Putting the numeric App ID in `TIKTOK_CLIENT_ID` results in an invalid client error.

1. Go to the [TikTok for Developers Portal](https://developers.tiktok.com/) and create a new App.
2. Under **Basic Information**, fill out your App Icon, Category, Description, Terms of Service URL, and Privacy Policy URL.
3. Under **Products**, click **Add products** and add:
   * **Login Kit**
   * **Content Posting API** (Enable **Direct Post**)
4. Under **Login Kit -> Redirect URI** (Web), add:
   ```text
   {FRONTEND_URL}/integrations/social/tiktok
   ```
5. Under **Scopes**, ensure the following are enabled:
   * `user.info.basic`, `user.info.profile`, `user.info.stats`
   * `video.list`, `video.publish`, `video.upload`
6. Note that TikTok requires public HTTPS Redirect URIs (if testing locally, use a tunnel like Cloudflare Tunnel or ngrok). If testing before audit approval, register your TikTok account under **Sandbox** settings.
7. Copy the **Client Key** (assign to `TIKTOK_CLIENT_ID`) and **Client Secret** (assign to `TIKTOK_CLIENT_SECRET`).

---

### 7. Reddit (`reddit`)
1. Go to [Reddit App Preferences](https://www.reddit.com/prefs/apps), scroll to the bottom, and click **create another app...**.
2. Fill in the form:
   * **Name:** `Postiz` (or your custom app name)
   * **App type:** Select the **web app** radio button (do **not** select `script` or `installed app`).
   * **Description / About URL:** `{FRONTEND_URL}`
   * **Redirect URI:**
     ```text
     {FRONTEND_URL}/integrations/social/reddit
     ```
3. Click **create app**.
4. Locate your credentials on the created card:
   * **Client ID (`REDDIT_CLIENT_ID`):** The 14-character string located **directly underneath `"web app"`** in the top-left corner of the card.
   * **Client Secret (`REDDIT_CLIENT_SECRET`):** The string labeled **secret**.
   *(Required scopes `identity`, `read`, `submit`, `flair`, `mysubreddits` are requested automatically by Postiz during OAuth).*

---

### 8. Pinterest (`pinterest`)
1. Log into a Pinterest Business account and go to the [Pinterest Developers Portal](https://developers.pinterest.com/apps/).
2. Click **Connect app** / **Create app** and complete the application details.
3. Once created, open your app's **Configure** page:
   * **Redirect URIs:**
     ```text
     {FRONTEND_URL}/integrations/social/pinterest
     ```
4. Request **Trial** or **Standard** API access with the following scopes:
   * `boards:read`, `boards:write`
   * `pins:read`, `pins:write`
   * `user_accounts:read`
5. Copy the **App ID** (assign to `PINTEREST_CLIENT_ID`) and **App Secret key** (assign to `PINTEREST_CLIENT_SECRET`).

---

## 3. Formatting Credentials in the Postiz `.env` File

Place the credentials in your `.env` file (or `docker-compose.yml` `environment:` block) using the exact variable names below:

```dotenv
# ============================================================================
# CORE URLS (Must NOT have a trailing slash)
# ============================================================================
MAIN_URL="https://postiz.yourdomain.com"
FRONTEND_URL="https://postiz.yourdomain.com"
NEXT_PUBLIC_BACKEND_URL="https://postiz.yourdomain.com/api"

# ============================================================================
# 1. X (Twitter) — Use OAuth 1.0a Consumer API Key & Secret
# ============================================================================
X_API_KEY="your_x_consumer_api_key"
X_API_SECRET="your_x_consumer_api_secret"

# ============================================================================
# 2. LINKEDIN & LINKEDIN PAGE — Shared for both Personal & Page integrations
# ============================================================================
LINKEDIN_CLIENT_ID="your_linkedin_client_id"
LINKEDIN_CLIENT_SECRET="your_linkedin_client_secret"

# ============================================================================
# 3. FACEBOOK PAGE & INSTAGRAM BUSINESS — Top-level Meta App ID & Secret
# ============================================================================
FACEBOOK_APP_ID="your_meta_basic_settings_app_id"
FACEBOOK_APP_SECRET="your_meta_basic_settings_app_secret"

# ============================================================================
# 4. INSTAGRAM STANDALONE — Sub-App ID from "Instagram -> API setup" tab
# ============================================================================
INSTAGRAM_APP_ID="your_instagram_login_specific_app_id"
INSTAGRAM_APP_SECRET="your_instagram_login_specific_app_secret"

# ============================================================================
# 5. THREADS — Sub-App ID from "Access the Threads API -> Settings" tab
# ============================================================================
THREADS_APP_ID="your_threads_specific_app_id"
THREADS_APP_SECRET="your_threads_specific_app_secret"

# ============================================================================
# 6. TIKTOK — Use alphanumeric "Client Key" for TIKTOK_CLIENT_ID
# ============================================================================
TIKTOK_CLIENT_ID="your_tiktok_client_key"
TIKTOK_CLIENT_SECRET="your_tiktok_client_secret"

# ============================================================================
# 7. REDDIT — Web App ID (underneath "web app" title) & Secret
# ============================================================================
REDDIT_CLIENT_ID="your_reddit_web_app_client_id"
REDDIT_CLIENT_SECRET="your_reddit_web_app_secret"

# ============================================================================
# 8. PINTEREST — Pinterest App ID & Secret
# ============================================================================
PINTEREST_CLIENT_ID="your_pinterest_app_id"
PINTEREST_CLIENT_SECRET="your_pinterest_app_secret"
```

---

## 4. Checklist to Bypass `"Invalid App ID"` & OAuth Errors

If you still encounter **`Invalid App ID`**, **`Invalid Client_ID`**, or **`Redirect URI Mismatch`** errors, verify these five common culprits:

1. **Meta Sub-App IDs vs. Main App ID (Facebook / Instagram / Threads):**
   * `FACEBOOK_APP_ID` **must** come from *App Settings -> Basic*.
   * `INSTAGRAM_APP_ID` **must** come from *Products -> Instagram -> API setup with Instagram login* (it is a different 15–16 digit number from the main Meta App ID).
   * `THREADS_APP_ID` **must** come from *Use cases -> Access the Threads API -> Settings* (also a distinct number from the main Meta App ID).
2. **Inline Comments or Whitespace in `.env` / Docker Compose:**
   * Never place inline comments without quotes (e.g., `FACEBOOK_APP_ID=123456 # my id` passes `123456 # my id` as the App ID in Docker `.env` files). Keep values cleanly quoted with no spaces inside the quotes.
   * In `docker-compose.yml` `environment:` lists, do **not** wrap values in literal quotes like `- FACEBOOK_APP_ID="123456"` (Docker Compose passes the quote characters into the container environment in list syntax). Either use `FACEBOOK_APP_ID=123456` in `docker-compose.yml` or load via `env_file: .env`.
3. **Connecting the Wrong Instagram Channel Type in the Postiz UI:**
   * Postiz shows two Instagram tiles: **Instagram (Facebook Business)** and **Instagram (Standalone)**.
   * Clicking **Instagram (Facebook Business)** uses `FACEBOOK_APP_ID`. Clicking **Instagram (Standalone)** uses `INSTAGRAM_APP_ID`. If you only configured one of them in `.env`, clicking the other sends an empty `client_id=` in the OAuth URL, which Meta rejects with `Invalid App ID`.
4. **Development Mode vs. Live Mode on Meta / TikTok:**
   * If your Meta or TikTok app is in **Development / Sandbox Mode**, only accounts explicitly added under **App Roles -> Testers / Admins** (and who have accepted the tester invite) can authenticate. Any other account attempting to log in will receive an `Invalid App ID` or `App Not Active` error.
5. **Recreating Containers After Editing `.env`:**
   * Running `docker compose restart` does **not** reload updated `.env` variables into running containers. Always recreate the container so the new environment variables take effect:
     ```bash
     docker compose up -d --force-recreate
     ```