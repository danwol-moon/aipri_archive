/**
 * 아이프리 아카이브 - 파츠 시트 자동 입력용 Google Apps Script
 *
 * 사용 시트: 파츠
 * 열 구조:
 * A ID
 * B 카테고리
 * C 이름
 * D 한국 이미지
 * E 일본 이미지
 * F 설명
 * G 태그
 * H 보유
 * I 한국실장
 *
 * ID를 A열에 입력하면 B/C/E가 자동으로 채워집니다.
 * H/I는 새 파츠의 기본값 FALSE로 넣습니다.
 * D(한국 이미지)는 한국 공식 사이트의 실제 이미지 URL 규칙이 확인되지 않아
 * 기존 값이 있으면 유지하고, 비어 있으면 빈칸으로 둡니다.
 * 사이트에서는 D가 있으면 D를 우선 사용하고, 없으면 E를 사용합니다.
 */

const AIPRI_CONFIG = {
  SHEET_NAME: '파츠',
  HEADER_ROW: 1,
  ID_COL: 1,
  PARTS_URL: 'https://aipri.jp/verse/parts/index2.html',
  JP_IMAGE_BASE: 'https://aipri.jp/verse/parts/img/',
  CACHE_KEY: 'AIPRI_PART_META_V1',
  CACHE_SECONDS: 21600, // 6시간
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

/**
 * 설치형 수정 트리거가 호출하는 함수.
 * Apps Script 편집기에서 트리거를 1회 추가하세요.
 */
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
  const values = sheet
    .getRange(firstRow, AIPRI_CONFIG.ID_COL, range.getNumRows(), 1)
    .getValues();

  const meta = getPartMetadata_();

  values.forEach((row, index) => {
    const targetRow = firstRow + index;
    const id = String(row[0] || '').trim();
    fillPartRow_(sheet, targetRow, id, meta);
  });
}

function fillPartRow_(sheet, row, id, meta) {
  // ID를 지우면 자동 입력 영역만 비웁니다. 설명/태그는 건드리지 않습니다.
  if (!id) {
    sheet.getRange(row, 2).clearContent(); // B 카테고리
    sheet.getRange(row, 3).clearContent(); // C 이름
    sheet.getRange(row, 4).clearContent(); // D 한국 이미지
    sheet.getRange(row, 5).clearContent(); // E 일본 이미지
    sheet.getRange(row, 8).clearContent(); // H 보유
    sheet.getRange(row, 9).clearContent(); // I 한국실장
    return;
  }

  const item = meta[id];
  if (!item) {
    // 모르는 ID는 기존 내용을 지우지 않고 표시만 남깁니다.
    sheet.getRange(row, 2).setValue('확인 필요');
    sheet.getRange(row, 3).setValue('ID를 공식 파츠 목록에서 찾지 못했습니다');
    if (!sheet.getRange(row, 5).getValue()) {
      sheet.getRange(row, 5).setValue(AIPRI_CONFIG.JP_IMAGE_BASE + id + '.webp');
    }
    if (sheet.getRange(row, 8).getValue() === '') sheet.getRange(row, 8).setValue(false);
    if (sheet.getRange(row, 9).getValue() === '') sheet.getRange(row, 9).setValue(false);
    return;
  }

  sheet.getRange(row, 2).setValue(item.category || '');
  sheet.getRange(row, 3).setValue(item.name || id);

  // 한국 이미지는 기존에 입력되어 있으면 유지합니다.
  // 비어 있으면 일본 이미지가 자동으로 채워지지 않도록 두어,
  // 사이트가 일본 이미지(E열)를 fallback으로 사용하게 합니다.
  if (sheet.getRange(row, 4).getValue() === '') {
    sheet.getRange(row, 4).setValue('');
  }

  sheet.getRange(row, 5).setValue(item.jpImage || (AIPRI_CONFIG.JP_IMAGE_BASE + id + '.webp'));

  // 보유 / 한국실장은 사용자가 직접 관리할 값이므로 기존 값이 있으면 유지합니다.
  if (sheet.getRange(row, 8).getValue() === '') sheet.getRange(row, 8).setValue(false);
  if (sheet.getRange(row, 9).getValue() === '') sheet.getRange(row, 9).setValue(false);
}

/**
 * 공식 일본 파츠 페이지에서
 * - 카테고리
 * - 이미지 alt에 적힌 파츠 이름
 * - 이미지 파일 URL
 * 을 읽어 ID별 목록을 만듭니다.
 */
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

  // h2/h3 등의 제목에서 카테고리를 추적합니다.
  const blocks = html.split(/(?=<h[1-6][^>]*>)/i);
  blocks.forEach(block => {
    const heading = block.match(/<h[1-6][^>]*>[\s\S]*?(?:alt|title)=["']([^"']+)["'][\s\S]*?<\/h[1-6]>/i);
    if (heading && CATEGORY_MAP[heading[1].trim()]) {
      currentCategory = CATEGORY_MAP[heading[1].trim()];
    }

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

  // 일부 페이지 구조에서 h2 추적이 실패해도 ID는 자동으로 채울 수 있도록
  // 파일명 기반의 보조 카테고리 판별을 수행합니다.
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

/** 캐시를 수동으로 새로고침할 때 사용하세요. */
function refreshAipriPartCache() {
  CacheService.getScriptCache().remove(AIPRI_CONFIG.CACHE_KEY);
  getPartMetadata_();
}
