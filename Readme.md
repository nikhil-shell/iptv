# Tuner IPTV Player

A static, browser-based player for M3U playlists. It can open a local `.m3u`/`.m3u8` playlist or fetch one from a URL, filter channels by group, search, and play compatible HLS streams. Playlists are processed in your browser and are not uploaded to this repository or a server.

## Run locally

Open `index.html` in a browser, or serve the repository directory with any static web server. Remote playlist URLs must allow browser access through CORS. Stream availability and playback also depend on the stream provider, browser support, and HTTPS compatibility.

## Publish with GitHub Pages

1. Push this repository to GitHub.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)`, then save.
5. Open the published URL shown in the Pages settings.

The site is plain HTML, CSS, and JavaScript; no build step or server configuration is needed. HLS playback uses [hls.js](https://github.com/video-dev/hls.js/) from jsDelivr.
