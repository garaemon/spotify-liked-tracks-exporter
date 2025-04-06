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
  getMySavedTracks, // Keep for logMyRecentLikedSongs
  getAllMySavedTracks, // Import the new function for all tracks
  getArtistsDetails,
} from './spotify-service';

// --- Authorization ---

/**
 * Initiates the Spotify OAuth2 authorization flow.
 * Run this function from the Apps Script editor.
 * It will open a dialog prompting you to authorize the script.
 */
function authorizeSpotify(): void {
  const spotifyService = getSpotifyService();
  if (!spotifyService.hasAccess()) {
    const redirectUrl = spotifyService.getRedirectUri();
    console.log(
      `Make sure that the callback Url on Spotify Web App is ${redirectUrl}`
    );
    const authorizationUrl = spotifyService.getAuthorizationUrl();
    // Use console.log for server-side functions or simple scripts.
    // For UI-driven scripts (like Sheets add-ons), you might show this URL differently.
    console.log(
      `Open the following URL to authorize: ${authorizationUrl}\nAfter authorizing, run logMySpotifyProfile() or other functions.`
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
 * We achieve this by assigning it to the `globalThis` object in TypeScript.
 * @param {object} request The request object passed by the OAuth2 library.
 * @returns {GoogleAppsScript.HTML.HtmlOutput} HTML output for the callback page.
 */
(globalThis as any).authCallback = (
  request: object
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
      'Not authorized. Please run authorizeSpotify() first and follow the instructions.'
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

/**
 * Logs the user's 10 most recently liked songs on Spotify.
 * Run this function from the Apps Script editor after authorizing.
 */
function logMyRecentLikedSongs(): void {
  if (!isSpotifyAuthorized()) {
    console.error(
      'Not authorized. Please run authorizeSpotify() first and follow the instructions.'
    );
    return;
  }

  console.log('Fetching recent liked songs...');
  const tracks = getMySavedTracks(10); // Get the 10 most recent tracks

  if (tracks && tracks.length > 0) {
    console.log('Your 10 most recently liked songs:');
    tracks.forEach((item, index) => {
      const track = item.track;
      const artists = track.artists.map(artist => artist.name).join(', ');
      console.log(
        `${index + 1}. ${track.name} - ${artists} (Album: ${track.album.name}) (Added: ${item.added_at})`
      );
    });
  } else if (tracks) {
    console.log('No liked songs found.');
  } else {
    console.error('Failed to fetch liked songs.');
  }
}

/**
 * Saves the user's most recently liked songs from Spotify to a Google Sheet.
 * Creates a sheet named "Spotify Liked Songs" if it doesn't exist.
 * Overwrites existing data in the sheet with *all* liked songs.
 */
function saveLikedSongsToSheet(): void { // Remove limit parameter
  if (!isSpotifyAuthorized()) {
    console.error(
      'Not authorized. Please run authorizeSpotify() first and follow the instructions.'
    );
    return;
  }

  // Fetch ALL saved tracks using the new paginated function
  console.log('Fetching all liked songs from Spotify...');
  const savedTrackObjects = getAllMySavedTracks();

  if (savedTrackObjects === null) { // Check for null explicitly as empty array is valid
    console.error('Failed to fetch liked songs.');
    return;
  }

  if (savedTrackObjects.length === 0) {
    console.log('No liked songs found to save.');
    return;
  }

  // --- Fetch Artist Genres ---
  // Collect unique artist IDs from all tracks
  const artistIds = new Set<string>();
  savedTrackObjects.forEach(item => {
    item.track.artists.forEach(artist => {
      if (artist.id) {
        // Ensure artist object has an ID
        artistIds.add(artist.id);
      }
    });
  });

  const artistGenresMap: Map<string, string[]> = new Map();
  const uniqueArtistIds = Array.from(artistIds); // Convert Set to Array

  if (uniqueArtistIds.length > 0) {
    console.log(
      `Fetching genres for ${uniqueArtistIds.length} unique artists...`
    );
    const chunkSize = 50; // Spotify API limit for /artists endpoint
    let fetchedArtistCount = 0;

    for (let i = 0; i < uniqueArtistIds.length; i += chunkSize) {
      const chunk = uniqueArtistIds.slice(i, i + chunkSize);
      console.log(
        `Fetching artist details batch ${i / chunkSize + 1} (Artists ${i + 1}-${Math.min(i + chunkSize, uniqueArtistIds.length)})...`
      );
      const artistsDetails = getArtistsDetails(chunk);
      if (artistsDetails) {
        artistsDetails.forEach((artist) => {
          if (artist && artist.id && artist.genres) {
            artistGenresMap.set(artist.id, artist.genres);
            fetchedArtistCount++;
          }
        });
        // Optional delay between chunks if needed
        if (i + chunkSize < uniqueArtistIds.length) {
           Utilities.sleep(200);
        }
      } else {
        console.error(
          `Failed to fetch artist details for batch starting at index ${i}. Skipping batch.`
        );
        // Decide if you want to stop the whole process or just skip the batch
      }
    }
    console.log(
      `Successfully fetched genre details for ${fetchedArtistCount} artists.`
    );
  }
  // --- End Fetch Artist Genres ---

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      console.error(
        'No active spreadsheet found. Please open or create a spreadsheet.'
      );
      return;
    }
    const sheetName = 'Spotify Liked Songs';
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      console.log(`Created sheet: "${sheetName}"`);
    } else {
      console.log(`Using existing sheet: "${sheetName}"`);
    }

    // Prepare data for the sheet
    const header = [
      'Added At',
      'Release Date', // Add Release Date header
      'Track Name',
      'Artists',
      'Album Name',
      'Track ID',
      'Genres', // Move Genres before Track Link
      'Track Link',
    ];
    const data = savedTrackObjects.map(item => {
      const track = item.track;
      const artists = track.artists.map(artist => artist.name).join(', ');
      const trackLink = track.external_urls?.spotify || ''; // Get the Spotify URL

      // Collect genres for this track's artists
      const trackGenres = new Set<string>();
      track.artists.forEach(artist => {
        const genres = artistGenresMap.get(artist.id);
        if (genres) {
          genres.forEach(genre => trackGenres.add(genre));
        }
      });
      const genresString = Array.from(trackGenres).join(', '); // Combine genres
      const releaseDate = track.album?.release_date || ''; // Get the release date

      return [
        item.added_at,
        releaseDate, // Add release date data
        track.name,
        artists,
        track.album.name,
        track.id,
        genresString, // Move genres before track link
        trackLink,
      ];
    });

    // Clear existing content and write new data
    sheet.clearContents();
    const range = sheet.getRange(1, 1, data.length + 1, header.length); // +1 for header row
    range.setValues([header, ...data]);

    console.log(
      `Successfully saved ${savedTrackObjects.length} liked songs (with genre info for ${artistGenresMap.size} artists) to sheet "${sheetName}".`
    );
  } catch (e: any) {
    console.error(`Error saving songs to sheet: ${e.message || e}`);
  }
}

// --- Expose functions to Apps Script Editor ---
// These assignments make the functions visible and runnable directly from the Apps Script UI.
(globalThis as any).authorizeSpotify = authorizeSpotify;
(globalThis as any).resetSpotifyAuthorization = resetSpotifyAuthorization;
(globalThis as any).logMySpotifyProfile = logMySpotifyProfile;
(globalThis as any).logMyRecentLikedSongs = logMyRecentLikedSongs;
(globalThis as any).saveLikedSongsToSheet = saveLikedSongsToSheet;
