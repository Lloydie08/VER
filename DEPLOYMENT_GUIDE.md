# Deployment Guide for Vercel

This guide provides instructions for deploying the `Cookie-Fetcher` application to Vercel.

## 1. Prerequisites

Before you begin, ensure you have the following installed:

*   **Node.js**: Version 18 or higher.
*   **npm** or **Yarn**: Package managers for Node.js.
*   **Vercel CLI**: Install globally using `npm install -g vercel`.

## 2. Project Setup

1.  **Navigate to the project directory**:

    ```bash
    cd /path/to/Cookie-Fetcher
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    # or
    yarn install
    ```

## 3. Environment Variables

Your application requires certain environment variables to function correctly. These should be set in your Vercel project settings.

*   `SUPABASE_URL`: The URL of your Supabase project.
*   `SUPABASE_ANON_KEY`: Your Supabase public anon key.

To add these variables in Vercel:

1.  Go to your Vercel project dashboard.
2.  Navigate to **Settings** > **Environment Variables**.
3.  Add `SUPABASE_URL` and `SUPABASE_ANON_KEY` with their respective values.

## 4. Vercel Deployment

### Option A: Deploy using Vercel CLI

1.  **Login to Vercel** (if not already logged in):

    ```bash
    vercel login
    ```

2.  **Deploy your project** from the root directory:

    ```bash
    vercel
    ```

    Follow the prompts. When asked about the project settings, ensure the following:

    *   **Root Directory**: `./` (or `/home/ubuntu/project/Cookie-Fetcher` if deploying from a different location)
    *   **Build Command**: `npm run vercel-build`
    *   **Output Directory**: `dist/public`

### Option B: Deploy using Git Integration

1.  **Push your code to a Git repository** (GitHub, GitLab, or Bitbucket).
2.  **Import your Git repository** into Vercel.
3.  Vercel will automatically detect the `vercel.json` configuration and deploy your project.

    Ensure the environment variables mentioned in Section 3 are configured in your Vercel project settings.

## 5. Post-Deployment

After successful deployment, Vercel will provide you with a unique URL for your application. You can access your deployed application through this URL.

**Author**: Manus AI
