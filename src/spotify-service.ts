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
  'user-library-read', // Add scope to read user's saved tracks
  // Add other scopes like 'playlist-read-private', etc.
].join(' ');

// Callback function name must match the one registered globally
const CALLBACK_FUNCTION_NAME = 'authCallback';

/**
 * Gets the configured OAuth2 service for Spotify.
 * Throws an error if Spotify client ID or secret are not set.
 * @returns {GoogleAppsScriptOAuth2.OAuth2Service} The configured OAuth2 service.
 */
export function getSpotifyService(): GoogleAppsScriptOAuth2.OAuth2Service {
  const userProperties = PropertiesService.getUserProperties();
  const scriptProperties = PropertiesService.getScriptProperties();
  const clientId = scriptProperties.getProperty('SPOTIFY_CLIENT_ID');
  const clientSecret = scriptProperties.getProperty('SPOTIFY_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error(
      'Spotify Client ID or Client Secret not set. Please run setSpotifyCredentials(clientId, clientSecret) first.'
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
  request: object
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
  options?: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions
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
      console.error(
        `Failed to parse Spotify response: ${e}\nResponse: ${responseBody}`
      );
      return null;
    }
  } else if (responseCode === 401) {
    // Token might have expired or been revoked
    console.error(
      `Spotify API Error (Unauthorized): ${responseCode} ${responseBody}`
    );
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
  // https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile
}

interface SpotifyArtist {
  id: string; // Artist ID is needed to fetch genres
  name: string;
  genres?: string[]; // Genres associated with the artist (optional)
  // Add other artist fields if needed
  // https://developer.spotify.com/documentation/web-api/reference/get-artist
}

interface SpotifyAlbum {
  name: string;
  // Add other album fields if needed
}

interface SpotifyExternalUrls {
  spotify: string; // The Spotify URL for the object.
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  external_urls: SpotifyExternalUrls; // Add external URLs containing the track link
  // Add other track fields if needed
  // https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks
}

interface SpotifySavedTrackObject {
  added_at: string; // Timestamp when the track was saved
  track: SpotifyTrack;
}

interface SpotifySavedTracksResponse {
  href: string;
  items: SpotifySavedTrackObject[];
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
}

/**
 * Fetches the current user's Spotify profile.
 * @returns {SpotifyUserProfile | null} The user profile object or null on failure.
 */
export function getMySpotifyProfile(): SpotifyUserProfile | null {
  return fetchSpotifyApi<SpotifyUserProfile>('me');
}

// Response structure for the /v1/artists endpoint (plural)
interface SpotifyArtistsResponse {
  artists: SpotifyArtist[];
}

/**
 * Fetches details for multiple artists by their IDs.
 * @param {string[]} artistIds An array of Spotify Artist IDs (max 50 per request).
 * @returns {SpotifyArtist[] | null} An array of artist objects with details, or null on failure.
 */
export function getArtistsDetails(artistIds: string[]): SpotifyArtist[] | null {
  if (!artistIds || artistIds.length === 0) {
    return []; // Return empty array if no IDs are provided
  }
  // Spotify API allows up to 50 IDs per request
  if (artistIds.length > 50) {
    console.warn(
      'Fetching details for more than 50 artists, only the first 50 will be fetched.'
    );
    artistIds = artistIds.slice(0, 50);
  }

  const idsParam = artistIds.join(',');
  const response = fetchSpotifyApi<SpotifyArtistsResponse>(
    `artists?ids=${idsParam}`
  );
  return response ? response.artists : null;
}

/**
 * Fetches the current user's recently saved (liked) tracks from Spotify.
 * @param {number} [limit=10] The maximum number of tracks to retrieve (1-50). Defaults to 10.
 * @returns {SpotifySavedTrackObject[] | null} An array of saved track objects or null on failure.
 */
export function getMySavedTracks(limit = 10): SpotifySavedTrackObject[] | null {
  // Ensure limit is within Spotify's allowed range (1-50)
  const validLimit = Math.max(1, Math.min(50, limit));
  const response = fetchSpotifyApi<SpotifySavedTracksResponse>(
    `me/tracks?limit=${validLimit}`
  );
  return response ? response.items : null;
}
