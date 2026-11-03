const playlistForm = document.querySelector('#playlist-form');
const playlistUrl = document.querySelector('#playlist-url');
const playlistFile = document.querySelector('#playlist-file');
const channelList = document.querySelector('#channel-list');
const channelSearch = document.querySelector('#channel-search');
const groupFilter = document.querySelector('#group-filter');
const channelCount = document.querySelector('#channel-count');
const playlistLabel = document.querySelector('#playlist-label');
const currentTitle = document.querySelector('#current-title');
const currentGroup = document.querySelector('#current-group');
const currentDescription = document.querySelector('#current-description');
const channelArt = document.querySelector('#channel-art');
const playerPlaceholder = document.querySelector('#player-placeholder');
const playerError = document.querySelector('#player-error');
const streamState = document.querySelector('#stream-state');
const notice = document.querySelector('#notice');
const video = document.querySelector('#video');

let channels = [];
let selectedChannel = null;
let hlsPlayer = null;
let sourceObjectUrl = null;

function parsePlaylist(text, baseUrl = '') {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const parsed = [];
  let metadata = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const comma = line.indexOf(',');
      const details = comma === -1 ? line : line.slice(0, comma);
      const attributes = Object.fromEntries(
        [...details.matchAll(/([\w-]+)="([^"]*)"/g)].map((match) => [match[1].toLowerCase(), match[2]])
      );
      metadata = {
        name: (comma === -1 ? '' : line.slice(comma + 1)).trim() || attributes['tvg-name'] || 'Untitled channel',
        group: attributes['group-title'] || 'Other',
        logo: attributes['tvg-logo'] || '',
      };
      continue;
    }

    if (line.startsWith('#') || !metadata) continue;

    let url = line;
    if (baseUrl) {
      try {
        url = new URL(line, baseUrl).href;
      } catch {
        // Keep the original stream URL if it is not a valid relative URL.
      }
    }
    parsed.push({ ...metadata, url });
    metadata = null;
  }

  return parsed;
}

function showNotice(message = '') {
  notice.textContent = message;
  notice.hidden = !message;
}

function loadPlaylist(text, name, baseUrl = '') {
  const result = parsePlaylist(text, baseUrl);
  if (!result.length) {
    showNotice('No playable channels were found. Check that the playlist contains #EXTINF entries followed by stream URLs.');
    return;
  }

  stopPlayback();
  channels = result;
  selectedChannel = null;
  playlistLabel.textContent = name.toUpperCase();
  channelCount.textContent = String(channels.length);
  channelSearch.value = '';
  buildGroupFilter();
  renderChannels();
  currentTitle.textContent = 'Choose a channel';
  currentGroup.textContent = 'TUNER PLAYER';
  currentDescription.textContent = 'Your playlist is loaded locally and is never uploaded.';
  setChannelArt('', 'T');
  playerPlaceholder.hidden = false;
  playerError.hidden = true;
  streamState.classList.remove('is-live');
  streamState.innerHTML = '<span></span> STANDING BY';
  showNotice('');
}

function buildGroupFilter() {
  const selectedGroup = groupFilter.value;
  const groups = [...new Set(channels.map((channel) => channel.group))].sort((a, b) => a.localeCompare(b));
  groupFilter.replaceChildren(new Option('All channels', 'all'));
  for (const group of groups) groupFilter.add(new Option(group, group));
  groupFilter.value = groups.includes(selectedGroup) ? selectedGroup : 'all';
}

function renderChannels() {
  const query = channelSearch.value.trim().toLocaleLowerCase();
  const group = groupFilter.value;
  const visible = channels
    .map((channel, index) => ({ channel, index }))
    .filter(({ channel }) => (group === 'all' || channel.group === group)
      && channel.name.toLocaleLowerCase().includes(query));

  channelList.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('div');
    empty.className = 'library-empty';
    empty.textContent = channels.length ? 'No matching channels.' : 'Your channels will appear here.';
    channelList.append(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const { channel, index } of visible) {
    const button = document.createElement('button');
    button.className = 'channel-item';
    button.type = 'button';
    button.setAttribute('role', 'option');
    button.setAttribute('aria-selected', String(selectedChannel === index));
    button.addEventListener('click', () => playChannel(index));

    const logo = document.createElement('span');
    logo.className = 'channel-logo';
    if (channel.logo) {
      const image = document.createElement('img');
      image.src = channel.logo;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('error', () => { logo.textContent = initials(channel.name); });
      logo.append(image);
    } else {
      logo.textContent = initials(channel.name);
    }

    const copy = document.createElement('span');
    copy.className = 'channel-copy';
    const name = document.createElement('strong');
    name.textContent = channel.name;
    const groupName = document.createElement('span');
    groupName.textContent = channel.group;
    copy.append(name, groupName);
    button.append(logo, copy);
    fragment.append(button);
  }
  channelList.append(fragment);
}

function initials(name) {
  return name.trim().slice(0, 1).toLocaleUpperCase() || 'T';
}

function setChannelArt(url, fallback) {
  channelArt.replaceChildren();
  if (url) {
    const image = document.createElement('img');
    image.src = url;
    image.alt = '';
    image.addEventListener('error', () => { channelArt.textContent = fallback; });
    channelArt.append(image);
  } else {
    channelArt.textContent = fallback;
  }
}

function stopPlayback() {
  if (hlsPlayer) {
    hlsPlayer.destroy();
    hlsPlayer = null;
  }
  video.pause();
  video.removeAttribute('src');
  video.load();
  playerError.hidden = true;
  streamState.classList.remove('is-live');
  streamState.innerHTML = '<span></span> STANDING BY';
}

function reportPlaybackError(message) {
  playerError.textContent = message;
  playerError.hidden = false;
  streamState.classList.remove('is-live');
  streamState.innerHTML = '<span></span> STREAM UNAVAILABLE';
}

async function playChannel(index) {
  const channel = channels[index];
  if (!channel) return;
  selectedChannel = index;
  renderChannels();
  currentTitle.textContent = channel.name;
  currentGroup.textContent = channel.group.toUpperCase();
  currentDescription.textContent = channel.url;
  setChannelArt(channel.logo, initials(channel.name));
  playerPlaceholder.hidden = true;
  playerError.hidden = true;
  showNotice('');
  stopPlayback();
  playerPlaceholder.hidden = true;

  const isHls = /\.m3u8(?:$|[?#])/i.test(channel.url);
  if (isHls && window.Hls?.isSupported()) {
    hlsPlayer = new window.Hls();
    hlsPlayer.on(window.Hls.Events.ERROR, (_event, data) => {
      if (data.fatal) reportPlaybackError('This stream could not be played. It may be offline, blocked by CORS, or require access that this browser cannot provide.');
    });
    hlsPlayer.loadSource(channel.url);
    hlsPlayer.attachMedia(video);
  } else if (video.canPlayType('application/vnd.apple.mpegurl') || !isHls) {
    video.src = channel.url;
  } else if (window.Hls?.isSupported()) {
    hlsPlayer = new window.Hls();
    hlsPlayer.loadSource(channel.url);
    hlsPlayer.attachMedia(video);
  } else {
    reportPlaybackError('HLS playback is not supported in this browser. Try Safari or a browser with Media Source Extensions.');
    return;
  }

  try {
    await video.play();
  } catch {
    streamState.innerHTML = '<span></span> READY TO PLAY';
  }
}

video.addEventListener('playing', () => {
  streamState.classList.add('is-live');
  streamState.innerHTML = '<span></span> PLAYING';
});

video.addEventListener('error', () => {
  if (selectedChannel !== null) reportPlaybackError('Playback failed. The stream may be offline, unsupported, or blocked by the stream provider.');
});

playlistForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = playlistUrl.value.trim();
  if (!url) return;
  showNotice('');
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`The server returned ${response.status}.`);
    loadPlaylist(await response.text(), new URL(url).pathname.split('/').pop() || 'Remote playlist', url);
  } catch (error) {
    showNotice(`Could not load this playlist. ${error.message || 'The server may block browser access (CORS). Try opening the M3U file instead.'}`);
  }
});

playlistFile.addEventListener('change', async () => {
  const file = playlistFile.files?.[0];
  if (!file) return;
  try {
    if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
    sourceObjectUrl = URL.createObjectURL(file);
    loadPlaylist(await file.text(), file.name);
  } catch {
    showNotice('Could not read that file. Please choose a valid M3U playlist.');
  }
  playlistFile.value = '';
});

channelSearch.addEventListener('input', renderChannels);
groupFilter.addEventListener('change', renderChannels);
document.addEventListener('keydown', (event) => {
  if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    channelSearch.focus();
  }
});