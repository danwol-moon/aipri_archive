/**
 * 아이프리 아카이브 - Google Apps Script
 *
 * 파츠:
 * A ID / B 카테고리 / C 이름 / D 한국 이미지 / E 일본 이미지 / F 보유 / G 한국 실장
 *
 * 악곡:
 * A ID / B 카테고리 / C 이름 / D 이미지 / E 설명 / F 태그
 *
 * 악곡 D열에는 Google Drive 파일 링크를 넣어도 됩니다.
 * Apps Script가 Drive 이미지를 GitHub 저장소로 복사한 뒤
 * GitHub Pages 이미지 주소를 사이트에 반환합니다.
 */

const AIPRI_CONFIG = {
  SHEET_NAME: '파츠',
  HEADER_ROW: 1,
  ID_COL: 1,
  PARTS_URL: 'https://aipri.jp/verse/parts/index2.html',
  JP_IMAGE_BASE: 'https://aipri.jp/verse/parts/img/',
  CACHE_KEY: 'AIPRI_PART_META_V1',
  CACHE_SECONDS: 21600,

  // 악곡 이미지 자동 복사용 GitHub 설정
  GITHUB_OWNER: 'danwol-moon',
  GITHUB_REPO: 'aipri_archive',
  GITHUB_BRANCH: 'main',
  GITHUB_SONG_IMAGE_DIR: 'images/songs',
  GITHUB_PAGE_BASE: 'https://danwol-moon.github.io/aipri_archive/images/songs/',
  GITHUB_TOKEN_PROPERTY: 'GITHUB_TOKEN',
  SONG_IMAGE_CACHE_PREFIX: 'AIPRI_SONG_IMAGE_',
};

const CATEGORY_MAP = {
  'フェイス': '얼굴 타입',
  'ボイス': '보이스',
  'はだ': '스킨 컬러',
  'まえがみ': '앞머리',
  'うしろがみ': '뒷머리',
  'ヘアカラー': '헤어 컬러',
  'アイカラー': '아이 컬러',
  'メッシュタイプ': '매쉬 타입',
  'メッシュカラー': '매쉬 컬러',
  'ヘアデコ': '헤어 데코',
  'メイク': '메이크업',
  'ワンポイント': '원 포인트',
  'アイプリブレス': '브레스',
  'ブレス': '브레스',
  'ファクト': '팩트',
};

function onEdit(e) {
  if (!e || !e.range) return;
  const range = e.range;
  const sheet = range.getSheet();
  if (sheet.getName() !== AIPRI_CONFIG.SHEET_NAME) return;
  if (range.getRow() <= AIPRI_CONFIG.HEADER_ROW) return;

  const firstCol = range.getColumn();
  const lastCol = firstCol + range.getNumColumns() - 1;
  if (AIPRI_CONFIG.ID_COL < firstCol || AIPRI_CONFIG.ID_COL > lastCol) return;

  const firstRow = range.getRow();
  const values = sheet.getRange(firstRow, AIPRI_CONFIG.ID_COL, range.getNumRows(), 1).getValues();
  const meta = getPartMetadata_();

  values.forEach((row, index) => {
    fillPartRow_(sheet, firstRow + index, String(row[0] || '').trim(), meta);
  });
}

function fillPartRow_(sheet, row, id, meta) {
  if (!id) {
    sheet.getRange(row, 2, 1, 6).clearContent();
    return;
  }

  const item = meta[id];
  if (!item) {
    sheet.getRange(row, 2).setValue('확인 필요');
    sheet.getRange(row, 3).setValue('ID를 공식 파츠 목록에서 찾지 못했습니다');
    if (!sheet.getRange(row, 5).getValue()) {
      sheet.getRange(row, 5).setValue(AIPRI_CONFIG.JP_IMAGE_BASE + id + '.webp');
    }
    if (sheet.getRange(row, 6).getValue() === '') sheet.getRange(row, 6).setValue(false);
    if (sheet.getRange(row, 7).getValue() === '') sheet.getRange(row, 7).setValue(false);
    return;
  }

  sheet.getRange(row, 2).setValue(item.category || '');
  sheet.getRange(row, 3).setValue(item.name || id);

  // D열 한국 이미지는 사용자가 넣은 값을 유지합니다.
  sheet.getRange(row, 5).setValue(item.jpImage || (AIPRI_CONFIG.JP_IMAGE_BASE + id + '.webp'));

  if (sheet.getRange(row, 6).getValue() === '') sheet.getRange(row, 6).setValue(false);
  if (sheet.getRange(row, 7).getValue() === '') sheet.getRange(row, 7).setValue(false);
}

function getPartMetadata_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(AIPRI_CONFIG.CACHE_KEY);
  if (cached) return JSON.parse(cached);

  const html = UrlFetchApp.fetch(AIPRI_CONFIG.PARTS_URL, {
    muteHttpExceptions: true,
    followRedirects: true,
  }).getContentText('UTF-8');

  if (!html) throw new Error('공식 일본 파츠 페이지를 읽지 못했습니다.');

  const result = {};
  let currentCategory = '';
  const blocks = html.split(/(?=<h[1-6][^>]*>)/i);

  blocks.forEach(block => {
    const heading = block.match(/<h[1-6][^>]*>[\s\S]*?(?:alt|title)=["']([^"']+)["'][\s\S]*?<\/h[1-6]>/i);
    if (heading && CATEGORY_MAP[heading[1].trim()]) currentCategory = CATEGORY_MAP[heading[1].trim()];

    const imgRegex = /<img[^>]+>/gi;
    let match;
    while ((match = imgRegex.exec(block)) !== null) {
      const tag = match[0];
      const srcMatch = tag.match(/(?:src|data-src)=["']([^"']*\/parts\/img\/([^"']+?\.webp))["']/i);
      if (!srcMatch) continue;

      const url = decodeHtml_(srcMatch[1]);
      const filename = decodeURIComponent(srcMatch[2]);
      const id = filename.replace(/\.webp$/i, '');
      const altMatch = tag.match(/alt=["']([^"']*)["']/i);
      const name = altMatch ? decodeHtml_(altMatch[1]).trim() : id;

      if (!result[id]) {
        result[id] = {
          category: currentCategory,
          name,
          jpImage: url.startsWith('http') ? url : 'https://aipri.jp' + url,
        };
      }
    }
  });

  Object.keys(result).forEach(id => {
    if (!result[id].category) result[id].category = categoryFromId_(id);
  });

  cache.put(AIPRI_CONFIG.CACHE_KEY, JSON.stringify(result), AIPRI_CONFIG.CACHE_SECONDS);
  return result;
}

function categoryFromId_(id) {
  const rules = [
    [/^Face_/i, '얼굴 타입'],
    [/^Voice_/i, '보이스'],
    [/^Skin_/i, '스킨 컬러'],
    [/^Fronthair_/i, '앞머리'],
    [/^Backhair_/i, '뒷머리'],
    [/^Haircolor_/i, '헤어 컬러'],
    [/^Eyecolor_/i, '아이 컬러'],
    [/^Mesh(Type)?_/i, '매쉬 타입'],
    [/^MeshColor_/i, '매쉬 컬러'],
    [/^Hairdeco_/i, '헤어 데코'],
    [/^Makeup_/i, '메이크업'],
    [/^Onepoint_/i, '원 포인트'],
    [/^Breath_/i, '브레스'],
    [/^Fact_/i, '팩트'],
  ];
  const found = rules.find(([re]) => re.test(id));
  return found ? found[1] : '';
}

function decodeHtml_(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function refreshAipriPartCache() {
  CacheService.getScriptCache().remove(AIPRI_CONFIG.CACHE_KEY);
  getPartMetadata_();
}

// ============================================================
// 악곡 이미지: Google Drive -> GitHub -> GitHub Pages
// ============================================================

function extractDriveFileId_(value) {
  const v = String(value || '').trim();
  if (!v) return '';

  // /file/d/FILE_ID/view
  let m = v.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (m) return m[1];

  // open?id=FILE_ID / uc?id=FILE_ID / thumbnail?id=FILE_ID
  m = v.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (m) return m[1];

  // 이미 파일 ID만 넣은 경우도 허용
  if (/^[a-zA-Z0-9_-]{20,}$/.test(v)) return v;

  return '';
}

function isDriveImage_(value) {
  return !!extractDriveFileId_(value);
}

function extensionFromMime_(mime) {
  const map = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };
  return map[String(mime || '').toLowerCase()] || '';
}

function getGitHubToken_() {
  const token = PropertiesService.getScriptProperties().getProperty(AIPRI_CONFIG.GITHUB_TOKEN_PROPERTY);
  if (!token) {
    throw new Error('GitHub 토큰이 설정되지 않았습니다. Apps Script > 프로젝트 설정 > 스크립트 속성에서 GITHUB_TOKEN을 등록해주세요.');
  }
  return token.trim();
}

function githubRequest_(method, path, body) {
  const url = 'https://api.github.com/repos/' +
    encodeURIComponent(AIPRI_CONFIG.GITHUB_OWNER) + '/' +
    encodeURIComponent(AIPRI_CONFIG.GITHUB_REPO) +
    '/contents/' + path.split('/').map(encodeURIComponent).join('/');

  const options = {
    method: method,
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + getGitHubToken_(),
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };

  if (body !== undefined) {
    options.contentType = 'application/json';
    options.payload = JSON.stringify(body);
  }

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const text = response.getContentText('UTF-8');
  let data = {};
  try { data = JSON.parse(text); } catch (_) {}

  if (code < 200 || code >= 300) {
    throw new Error('GitHub API 오류 ' + code + ': ' + (data.message || text || '알 수 없는 오류'));
  }

  return data;
}

function githubSongImageUrl_(fileId, blob) {
  const ext = extensionFromMime_(blob.getContentType());
  if (!ext) throw new Error('지원하지 않는 이미지 형식입니다: ' + blob.getContentType());

  const path = AIPRI_CONFIG.GITHUB_SONG_IMAGE_DIR + '/' + fileId + '.' + ext;

  // 같은 파일 ID가 이미 GitHub에 있으면 SHA를 받아 업데이트합니다.
  let existing = null;
  try {
    existing = githubRequest_('get', path);
  } catch (_) {}

  const contentBase64 = Utilities.base64Encode(blob.getBytes());
  const body = {
    message: 'Update song image ' + fileId,
    content: contentBase64,
    branch: AIPRI_CONFIG.GITHUB_BRANCH,
  };

  if (existing && existing.sha) body.sha = existing.sha;

  githubRequest_('put', path, body);
  return AIPRI_CONFIG.GITHUB_PAGE_BASE + encodeURIComponent(fileId) + '.' + ext;
}

function driveImageToGitHub_(driveUrl) {
  const fileId = extractDriveFileId_(driveUrl);
  if (!fileId) return String(driveUrl || '').trim();

  const cache = CacheService.getScriptCache();
  const cacheKey = AIPRI_CONFIG.SONG_IMAGE_CACHE_PREFIX + fileId;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const file = DriveApp.getFileById(fileId);
  const blob = file.getBlob();
  const mime = String(blob.getContentType() || '').toLowerCase();

  if (mime.indexOf('image/') !== 0) {
    throw new Error('Drive 파일이 이미지가 아닙니다: ' + file.getName());
  }

  const url = githubSongImageUrl_(fileId, blob);
  cache.put(cacheKey, url, 21600);
  return url;
}

/**
 * D열의 Drive 링크를 GitHub 이미지 URL로 변환합니다.
 * 이미 일반 URL이면 그대로 둡니다.
 */
function normalizeSongImage_(value) {
  const v = String(value || '').trim();
  if (!v) return '';

  if (isDriveImage_(v)) {
    return driveImageToGitHub_(v);
  }

  const imageFormula = v.match(/^=IMAGE\(\s*["']([^"']+)["']/i);
  if (imageFormula) {
    const inner = imageFormula[1];
    return isDriveImage_(inner) ? driveImageToGitHub_(inner) : inner;
  }

  return v;
}

// ============================================================
// 개인 CODE 기능 (웹 앱)
// 필요한 시트: 사용자 / 보유데이터
// ============================================================

const USER_SHEET_NAME = '사용자';
const OWNERSHIP_SHEET_NAME = '보유데이터';

function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  const action = String(p.action || '').trim();

  if (action === 'sheet') {
    const sheetName = String(p.sheet || '').trim();
    const rows = readSheetRows_(sheetName);
    return jsonp_({ok:true, sheet:sheetName, rows}, p.callback);
  }

  if (action !== 'load') {
    return jsonp_({ok:true, message:'AIPRI archive API is running.'}, p.callback);
  }

  const code = String(p.code || '').trim();
  const user = findUser_(code);
  if (!user) return jsonp_({ok:false, message:'등록되지 않은 개인 코드입니다.'}, p.callback);
  if (!user.enabled) return jsonp_({ok:false, message:'사용이 중지된 개인 코드입니다.'}, p.callback);

  const owned = readOwnership_(code);
  return jsonp_({ok:true, name:user.name, owned}, p.callback);
}

function readSheetRows_(sheetName) {
  const allowed = ['파츠','악곡'];
  if (!allowed.includes(sheetName)) return [];

  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 1) return [];

  const values = sh.getDataRange().getDisplayValues();

  return values.map((row, index) => {
    const out = row.map(v => String(v ?? '').trim());

    // 악곡 D열(4번째 열)이 Drive 이미지라면 GitHub로 자동 복사합니다.
    // 헤더 행은 건너뜁니다.
    if (sheetName === '악곡' && index > 0 && out[0]) {
      try {
        out[3] = normalizeSongImage_(out[3]);
      } catch (err) {
        // 이미지 하나가 실패해도 전체 악곡 목록은 내려가도록 합니다.
        // 실패 원인은 원래 Drive URL을 유지하여 디버깅하기 쉽게 합니다.
        console.warn('악곡 이미지 변환 실패: ' + out[0] + ' / ' + err.message);
      }
    }

    return out;
  });
}

function doPost(e) {
  const p = e && e.parameter ? e.parameter : {};
  if (p.action !== 'save') {
    return ContentService.createTextOutput(JSON.stringify({ok:false,message:'Unknown action'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const code = String(p.code || '').trim();
  const partId = String(p.partId || '').trim();
  const owned = String(p.owned || '').toLowerCase() === 'true';
  const user = findUser_(code);

  if (!user || !user.enabled || !partId) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,message:'Invalid request'}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  writeOwnership_(code, partId, owned);

  return ContentService.createTextOutput(JSON.stringify({ok:true}))
    .setMimeType(ContentService.MimeType.JSON);
}

function findUser_(code) {
  if (!code) return null;
  const sh = SpreadsheetApp.getActive().getSheetByName(USER_SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return null;

  const rows = sh.getRange(2,1,sh.getLastRow()-1,3).getValues();

  for (const r of rows) {
    if (String(r[0] || '').trim() === code) {
      const enabled = String(r[2]).toLowerCase() === 'true' ||
        r[2] === true ||
        String(r[2]).trim() === '사용';
      return {name:String(r[1] || '').trim(), enabled};
    }
  }

  return null;
}

function readOwnership_(code) {
  const sh = SpreadsheetApp.getActive().getSheetByName(OWNERSHIP_SHEET_NAME);
  const out = {};
  if (!sh || sh.getLastRow() < 2) return out;

  const rows = sh.getRange(2,1,sh.getLastRow()-1,3).getValues();

  rows.forEach(r => {
    if (
      String(r[0] || '').trim() === code &&
      (r[2] === true || String(r[2]).toLowerCase() === 'true')
    ) {
      out[String(r[1] || '').trim()] = true;
    }
  });

  return out;
}

function writeOwnership_(code, partId, owned) {
  const sh = SpreadsheetApp.getActive().getSheetByName(OWNERSHIP_SHEET_NAME);
  if (!sh) throw new Error('보유데이터 시트가 없습니다.');

  const last = sh.getLastRow();

  if (last >= 2) {
    const rows = sh.getRange(2,1,last-1,3).getValues();

    for (let i=0;i<rows.length;i++) {
      if (
        String(rows[i][0] || '').trim() === code &&
        String(rows[i][1] || '').trim() === partId
      ) {
        sh.getRange(i+2,3).setValue(owned);
        return;
      }
    }
  }

  sh.appendRow([code, partId, owned]);
}

function jsonp_(obj, callback) {
  const safe = String(callback || '').replace(/[^A-Za-z0-9_$]/g, '');

  if (!safe) {
    return ContentService.createTextOutput(JSON.stringify(obj))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(
    safe + '(' + JSON.stringify(obj) + ')'
  ).setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function setupAipriUserSheets() {
  const ss = SpreadsheetApp.getActive();

  let users = ss.getSheetByName(USER_SHEET_NAME);
  if (!users) users = ss.insertSheet(USER_SHEET_NAME);
  if (users.getLastRow() === 0) users.appendRow(['개인코드','이름','사용 여부']);

  let own = ss.getSheetByName(OWNERSHIP_SHEET_NAME);
  if (!own) own = ss.insertSheet(OWNERSHIP_SHEET_NAME);
  if (own.getLastRow() === 0) own.appendRow(['개인코드','파츠 ID','보유']);
}

/**
 * GitHub 연동 테스트.
 * 처음 설정할 때 실행하면 토큰과 GitHub 접근 권한이 정상인지 확인할 수 있습니다.
 */
function testGitHubConnection() {
  const token = getGitHubToken_();
  if (!token) throw new Error('GITHUB_TOKEN이 비어 있습니다.');

  const result = githubRequest_(
    'get',
    ''
  );

  Logger.log(JSON.stringify(result));
  return result.full_name || 'GitHub 연결 성공';
}
