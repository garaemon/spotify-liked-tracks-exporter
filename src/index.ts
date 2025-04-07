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
  getAllMySavedTracks, // Keep for potential full sync needs? Or remove if unused.
  getNewSavedTracks, // Import the function to get only new tracks
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
 * Updates a Google Sheet with the user's liked songs from Spotify.
 * Creates a sheet named "Spotify Liked Songs" if it doesn't exist.
 * Appends only the newly liked songs since the last update.
 */
function updateLikedSongsSheet(): void {
  if (!isSpotifyAuthorized()) {
    console.error(
      'Not authorized. Please run authorizeSpotify() first and follow the instructions.'
    );
    return;
  }

  // --- Get Existing Track IDs from Sheet ---
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    console.error(
      'No active spreadsheet found. Please open or create a spreadsheet.'
    );
    return;
  }
  const sheetName = 'Spotify Liked Songs';
  let sheet = ss.getSheetByName(sheetName);
  const existingTrackIds = new Set<string>();
  const header = [
    'Added At',
    'Release Date',
    'Track Name',
    'Artists',
    'Album Name',
    'Track ID',
    'Genres',
    'Track Link',
  ];
  let lastRow = 0;

  if (sheet) {
    console.log(`Reading existing tracks from sheet: "${sheetName}"`);
    const data = sheet.getDataRange().getValues();
    lastRow = data.length; // Get the last row number
    if (lastRow > 1) {
      // Check if there's data beyond the header
      const trackIdColumnIndex = header.indexOf('Track ID'); // Find the index of the Track ID column
      if (trackIdColumnIndex !== -1) {
        // Start from 1 to skip header row
        for (let i = 1; i < data.length; i++) {
          if (data[i] && data[i][trackIdColumnIndex]) {
            existingTrackIds.add(data[i][trackIdColumnIndex].toString());
          }
        }
        console.log(
          `Found ${existingTrackIds.size} existing track IDs in the sheet.`
        );
      } else {
        console.warn(
          'Could not find "Track ID" column in the sheet. Assuming no existing tracks.'
        );
      }
    } else {
      console.log('Sheet exists but is empty or only has a header.');
    }
  } else {
    console.log(`Sheet "${sheetName}" not found. It will be created.`);
    // Sheet will be created later if new tracks are found
  }

  // --- Fetch Only New Liked Songs from Spotify ---
  const newTracks = getNewSavedTracks(existingTrackIds);

  if (newTracks === null) {
    // Check for null explicitly (indicates an API error)
    console.error('Failed to fetch new liked songs due to an error.');
    return;
  }

  if (newTracks.length === 0) {
    console.log('No new liked songs found since the last update.');
    return;
  }

  console.log(`Found ${newTracks.length} new liked songs to add.`);

  // --- Fetch Artist Genres for New Tracks Only ---
  const artistIds = new Set<string>();
  newTracks.forEach(item => {
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
        artistsDetails.forEach(artist => {
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
    // Ensure sheet exists (it might have been created above or already existed)
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      console.log(`Created sheet: "${sheetName}"`);
      // Add header row to the new sheet
      sheet.appendRow(header);
      lastRow = 1; // Reset lastRow as we just added the header
    } else if (lastRow === 0) {
      // Sheet existed but was completely empty
      sheet.appendRow(header);
      lastRow = 1;
    } else if (
      lastRow === 1 &&
      sheet.getRange(1, 1, 1, header.length).getValues()[0].join('') === ''
    ) {
      // Sheet had one empty row, likely from previous clearing, overwrite with header
      sheet.getRange(1, 1, 1, header.length).setValues([header]);
    }
    // else: Sheet exists and has header/data, proceed to append

    // Prepare data for the new rows
    const newData = newTracks.map(item => {
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
        trackLink, // Track Link
      ];
    });

    // Append new data to the sheet
    if (newData.length > 0) {
      // Append rows starting after the last existing row
      const range = sheet.getRange(
        lastRow + 1,
        1,
        newData.length,
        header.length
      );
      range.setValues(newData);
      console.log(
        `Successfully appended ${newData.length} new liked songs (with genre info for ${artistGenresMap.size} artists) to sheet "${sheetName}".`
      );
    } else {
      // This case should technically be handled by the earlier check, but added for safety.
      console.log('No new songs were found to append.');
    }
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
(globalThis as any).updateLikedSongsSheet = updateLikedSongsSheet; // Update global function name
