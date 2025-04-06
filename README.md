<!--
Copyright 2025 Ryohei Ueda

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->
# spotify-liked-tracks-exporter
Export liked tracks from Spotify to Google Spreadsheet

## Configuration

This script requires some configuration values to be set in the Script Properties.

1.  Open your Google Apps Script project associated with this code.
2.  Click on the **Project Settings** icon (⚙️) in the left sidebar.
3.  Scroll down to the **Script Properties** section and click **Edit script properties**.
4.  Add the following properties (keys) and their corresponding values:
    *   `SPOTIFY_CLIENT_ID`: Your Spotify application Client ID. Get this from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
    *   `SPOTIFY_CLIENT_SECRET`: Your Spotify application Client Secret. Also from the Spotify Developer Dashboard.
5.  Click **Save script properties**.

## Set up Spotify App

1.  Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
2.  Log in with your Spotify account.
3.  Click **Create app**.
4.  Fill in the App name (e.g., "Google Sheets Liked Tracks Exporter") and Description. Accept the terms.
5.  Once the app is created, you'll see the **Client ID** and **Client Secret**. Copy these and add them to your Apps Script project's Script Properties as described in the **Configuration** section above.
6.  Click **Edit Settings**.
7.  In the **Redirect URIs** section, you need to add the specific callback URL for your Apps Script project.
    *   **Important:** To find the *exact* URL, first deploy your Apps Script project (Deploy > New Deployment > Type: Web app). Then, run the `authorizeSpotify` function from the Apps Script editor. Check the **Execution Log** (View > Logs). It will print a message like: `Make sure that the callback Url on Spotify Web App is [YOUR_REDIRECT_URI]`.
    *   The URL will look something like this: `https://script.google.com/macros/d/{SCRIPT ID}/usercallback`
8.  Copy this exact URL from the logs and paste it into the **Redirect URIs** field in the Spotify Developer Dashboard settings.
9.  Click **Add**, then scroll down and click **Save**.

## Usage

1.  **Authorize:** Run the `authorizeSpotify` function from the Apps Script editor. Follow the URL logged in the Execution Log to grant access to your Spotify account. You only need to do this once (unless you reset authorization).
2.  **(Optional) Reset Authorization:** If you need to re-authorize or change accounts, run `resetSpotifyAuthorization`.
3.  **(Optional) Check Profile:** Run `logMySpotifyProfile` to verify the connection is working and see which Spotify account is linked.
