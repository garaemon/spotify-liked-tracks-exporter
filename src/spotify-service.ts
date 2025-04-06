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
/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Define required Spotify scopes
// You can add more scopes as needed based on the API endpoints you want to access
// See: https://developer.spotify.com/documentation/web-api/concepts/scopes
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  // Add other scopes like 'playlist-read-private', 'user-library-read', etc.
].join(' ');

// Callback function name must match the one registered globally
const CALLBACK_FUNCTION_NAME = 'authCallback';

/**
 * Retrieves the Script Properties service for user properties.
 * @returns {GoogleAppsScript.Properties.Properties} The user properties store.
 */
function getUserProperties_(): GoogleAppsScript.Properties.Properties {
  return PropertiesService.getUserProperties();
}

/**
 * Gets the configured OAuth2 service for Spotify.
 * Throws an error if Spotify client ID or secret are not set.
 * @returns {GoogleAppsScriptOAuth2.OAuth2Service} The configured OAuth2 service.
 */
export function getSpotifyService(): GoogleAppsScriptOAuth2.OAuth2Service {
  const userProperties = getUserProperties_();
  const clientId = userProperties.getProperty('SPOTIFY_CLIENT_ID');
  const clientSecret = userProperties.getProperty('SPOTIFY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error(
      'Spotify Client ID or Client Secret not set. Please run setSpotifyCredentials(clientId, clientSecret) first.',
    );
  }

  return OAuth2.createService('spotify')
    .setAuthorizationBaseUrl('https://accounts.spotify.com/authorize')
    .setTokenUrl('https://accounts.spotify.com/api/token')
    .setClientId(clientId)
    .setClientSecret(clientSecret)
    .setCallbackFunction(CALLBACK_FUNCTION_NAME)
    .setPropertyStore(userProperties)
    .setScope(SPOTIFY_SCOPES)
    .setTokenHeaders({
      // Spotify requires client ID and secret in the Authorization header for token requests
      Authorization: `Basic ${Utilities.base64Encode(`${clientId}:${clientSecret}`)}`,
    })
    .setParam('show_dialog', 'true'); // Optional: Force user to re-approve scopes
}

/**
 * Handles the OAuth2 callback.
 * @param {object} request The request object from the callback invocation.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} HTML output indicating success or failure.
 */
export function handleAuthCallback(
  request: object,
): GoogleAppsScript.HTML.HtmlOutput {
  const spotifyService = getSpotifyService();
  const authorized = spotifyService.handleCallback(request);
  if (authorized) {
    return HtmlService.createHtmlOutput('Success! You can close this tab.');
  } else {
    return HtmlService.createHtmlOutput('Denied. You can close this tab');
  }
}

/**
 * Resets the Spotify OAuth2 service, forcing re-authentication.
 */
export function resetSpotifyService(): void {
  getSpotifyService().reset();
  console.log('Spotify service reset. Please re-authorize.');
}

/**
 * Checks if the user is authorized with Spotify.
 * @returns {boolean} True if authorized, false otherwise.
 */
export function isSpotifyAuthorized(): boolean {
  try {
    return getSpotifyService().hasAccess();
  } catch (e) {
    // If credentials aren't set, service creation fails, meaning not authorized.
    console.error(`Authorization check failed: ${e}`);
    return false;
  }
}

/**
 * Makes an authenticated request to the Spotify API.
 * @param {string} endpoint The API endpoint (e.g., 'me', 'playlists').
 * @param {GoogleAppsScript.URL_Fetch.URLFetchRequestOptions} [options] Optional request options (method, payload, etc.).
 * @returns {object | null} The JSON response from Spotify, or null if unauthorized or request fails.
 */
export function fetchSpotifyApi<T>(
  endpoint: string,
  options?: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions,
): T | null {
  const service = getSpotifyService();
  if (!service.hasAccess()) {
    console.error('Not authorized with Spotify.');
    // Consider throwing an error or returning a specific status
    return null;
  }

  const url = `https://api.spotify.com/v1/${endpoint}`;
  const defaultOptions: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    headers: {
      Authorization: `Bearer ${service.getAccessToken()}`,
    },
    method: 'get', // Default to GET
    muteHttpExceptions: true, // Prevent script failure on API errors (e.g., 404, 401)
  };

  const requestOptions = { ...defaultOptions, ...options };

  console.log(`Fetching Spotify API: ${requestOptions.method} ${url}`);
  const response = UrlFetchApp.fetch(url, requestOptions);
  const responseCode = response.getResponseCode();
  const responseBody = response.getContentText();

  if (responseCode === 200 || responseCode === 201) {
    try {
      return JSON.parse(responseBody) as T;
    } catch (e) {
      console.error(`Failed to parse Spotify response: ${e}\nResponse: ${responseBody}`);
      return null;
    }
  } else if (responseCode === 401) {
    // Token might have expired or been revoked
    console.error(`Spotify API Error (Unauthorized): ${responseCode} ${responseBody}`);
    resetSpotifyService(); // Reset service to force re-auth next time
    return null;
  } else {
    console.error(`Spotify API Error: ${responseCode} ${responseBody}`);
    return null;
  }
}

// --- Example API Call ---

interface SpotifyUserProfile {
  display_name: string;
  email: string;
  id: string;
  // Add other fields as needed from the Spotify API documentation
  // https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile
}

/**
 * Fetches the current user's Spotify profile.
 * @returns {SpotifyUserProfile | null} The user profile object or null on failure.
 */
export function getMySpotifyProfile(): SpotifyUserProfile | null {
  return fetchSpotifyApi<SpotifyUserProfile>('me');
}
