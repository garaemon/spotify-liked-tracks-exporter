/**
 * Copyright 2025 Ryohei Ueda
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import {
  getSpotifyService,
  handleAuthCallback,
  resetSpotifyService,
  isSpotifyAuthorized,
  getMySpotifyProfile,
} from './spotify-service';

// --- Configuration ---
// IMPORTANT: Run this function once from the Apps Script editor
//            to store your Spotify credentials securely.
//            Replace 'YOUR_CLIENT_ID' and 'YOUR_CLIENT_SECRET'
//            with the actual values from the Spotify Developer Dashboard.
function setSpotifyCredentials(clientId: string, clientSecret: string): void {
  PropertiesService.getUserProperties()
    .setProperty('SPOTIFY_CLIENT_ID', clientId)
    .setProperty('SPOTIFY_CLIENT_SECRET', clientSecret);
  console.log('Spotify credentials set successfully.');
  // It's good practice to reset the service if credentials change
  try {
    resetSpotifyService();
  } catch (e) {
    // Ignore error if service wasn't initialized yet
  }
}

// --- Authorization ---

/**
 * Initiates the Spotify OAuth2 authorization flow.
 * Run this function from the Apps Script editor.
 * It will open a dialog prompting you to authorize the script.
 */
function authorizeSpotify(): void {
  const spotifyService = getSpotifyService();
  if (!spotifyService.hasAccess()) {
    const authorizationUrl = spotifyService.getAuthorizationUrl();
    // Use console.log for server-side functions or simple scripts.
    // For UI-driven scripts (like Sheets add-ons), you might show this URL differently.
    console.log(
      `Open the following URL to authorize: ${authorizationUrl}\nAfter authorizing, run logMySpotifyProfile() or other functions.`,
    );

    // Alternatively, create a sidebar or dialog in a Sheet/Doc to show the link:
    // const template = HtmlService.createTemplate(
    //   '<a href="<?= url ?>" target="_blank">Authorize Spotify</a>'
    // );
    // template.url = authorizationUrl;
    // SpreadsheetApp.getUi().showSidebar(template.evaluate().setTitle('Authorization Required'));
  } else {
    console.log('Already authorized with Spotify.');
  }
}

/**
 * Resets Spotify authorization. User will need to re-authorize.
 * Run this function from the Apps Script editor if needed.
 */
function resetSpotifyAuthorization(): void {
  resetSpotifyService();
}

/**
 * The OAuth2 callback function.
 * This function MUST be exposed globally to be callable by the OAuth2 library.
 * We achieve this by assigning it to the `global` object in TypeScript.
 * @param {object} request The request object passed by the OAuth2 library.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} HTML output for the callback page.
 */
(global as any).authCallback = (
  request: object,
): GoogleAppsScript.HTML.HtmlOutput => {
  return handleAuthCallback(request);
};

// --- API Usage Example ---

/**
 * Logs the current user's Spotify profile information.
 * Run this function from the Apps Script editor after authorizing.
 */
function logMySpotifyProfile(): void {
  if (!isSpotifyAuthorized()) {
    console.error(
      'Not authorized. Please run authorizeSpotify() first and follow the instructions.',
    );
    // Optionally, call authorizeSpotify() directly here, but logging the URL is often safer
    // authorizeSpotify();
    return;
  }

  console.log('Fetching Spotify profile...');
  const profile = getMySpotifyProfile();

  if (profile) {
    console.log(`Logged in as: ${profile.display_name} (${profile.email})`);
    console.log(`User ID: ${profile.id}`);
    // Log other profile details as needed
  } else {
    console.error('Failed to fetch Spotify profile.');
  }
}

// --- Expose functions to Apps Script Editor ---
// These assignments make the functions visible and runnable directly from the Apps Script UI.
(global as any).setSpotifyCredentials = setSpotifyCredentials;
(global as any).authorizeSpotify = authorizeSpotify;
(global as any).resetSpotifyAuthorization = resetSpotifyAuthorization;
(global as any).logMySpotifyProfile = logMySpotifyProfile;
