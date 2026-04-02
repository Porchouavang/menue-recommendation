// app.js — client-side logic to fetch menu data, apply conditional scoring, and render results.

const DATA_URL = '/data/sample_menu.json';
// If you run the optional server (server.py) on port 5000 with GOOGLE_API_KEY & GOOGLE_CX,
// the client will call this proxy to fetch a Google image for items that don't have a local image.
const IMAGE_PROXY_BASE = 'http://localhost:5000/api/image?q='; // change port if needed

let data = [];

async function loadData(){
  const r = await fetch(DATA_URL);
  if(!r.ok) throw new Error('Failed to load data');
  return r.json();
}

function closeModal(modal){
  if(modal && modal.parentNode) modal.parentNode.remove();
}

function openEditModal(item){
  // create backdrop and modal
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'modal';

  const nameEn = (item.name && item.name.en) || '';
  const nameLo = (item.name && item.name.lo) || '';
  const nameHm = (item.name && item.name.hm) || '';
  const descEn = (item.description && item.description.en) || '';
  const descLo = (item.description && item.description.lo) || '';
  const descHm = (item.description && item.description.hm) || '';

  modal.innerHTML = `
    <h3>Edit: ${item.id}</h3>
    <div class="form-row">
      <label>Name (EN)<input id="fld_name_en" type="text" value="${escapeHtml(nameEn)}" /></label>
      <label>Name (LO)<input id="fld_name_lo" type="text" value="${escapeHtml(nameLo)}" /></label>
      <label>Name (HM)<input id="fld_name_hm" type="text" value="${escapeHtml(nameHm)}" /></label>
    </div>
    <div class="form-row">
      <label>Description (EN)<textarea id="fld_desc_en">${escapeHtml(descEn)}</textarea></label>
      <label>Description (LO)<textarea id="fld_desc_lo">${escapeHtml(descLo)}</textarea></label>
      <label>Description (HM)<textarea id="fld_desc_hm">${escapeHtml(descHm)}</textarea></label>
    </div>
    <div class="form-row">
      <label>Price<input id="fld_price" type="number" value="${item.price||0}" /></label>
      <label>Currency<input id="fld_currency" type="text" value="${item.currency||'LAK'}" /></label>
      <label>Category<input id="fld_category" type="text" value="${item.category||''}" /></label>
    </div>
    <div class="form-row">
      <label>Tags (comma separated)<input id="fld_tags" type="text" value="${(item.tags||[]).join(', ')}" /></label>
      <label>Spice level<input id="fld_spice" type="number" min="0" max="5" value="${item.spice_level||0}" /></label>
      <label>Availability<input id="fld_avail" type="text" value="${item.availability||''}" /></label>
    </div>
    <div class="form-row">
      <label>Preparation time (min)<input id="fld_prep" type="number" value="${item.preparation_time_minutes||0}" /></label>
      <label>Image URL<input id="fld_image" type="text" value="${item.image||''}" /></label>
    </div>
    <div class="form-actions">
      <button id="cancelEdit" class="btn secondary">Cancel</button>
    </div>
  `;

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  document.getElementById('cancelEdit').addEventListener('click', ()=> closeModal(backdrop));
  document.getElementById('saveEdit').addEventListener('click', ()=>{
    // build edited item
    const edited = JSON.parse(JSON.stringify(item));
    edited.name = edited.name || {};
    edited.description = edited.description || {};
    edited.name.en = document.getElementById('fld_name_en').value.trim();
    edited.name.lo = document.getElementById('fld_name_lo').value.trim();
    edited.name.hm = document.getElementById('fld_name_hm').value.trim();
    edited.description.en = document.getElementById('fld_desc_en').value.trim();
    edited.description.lo = document.getElementById('fld_desc_lo').value.trim();
    edited.description.hm = document.getElementById('fld_desc_hm').value.trim();
    edited.price = Number(document.getElementById('fld_price').value) || 0;
    edited.currency = document.getElementById('fld_currency').value.trim() || 'LAK';
    edited.category = document.getElementById('fld_category').value.trim();
    edited.tags = document.getElementById('fld_tags').value.split(',').map(s=>s.trim()).filter(Boolean);
    edited.spice_level = Number(document.getElementById('fld_spice').value) || 0;
    edited.availability = document.getElementById('fld_avail').value.trim();
    edited.preparation_time_minutes = Number(document.getElementById('fld_prep').value) || 0;
    edited.image = document.getElementById('fld_image').value.trim() || edited.image;

    // persist edit map
    const edits = getStoredEdits();
    edits[item.id] = edited;
    saveStoredEdits(edits);

    // update in-memory data
    const idx = data.findIndex(x=>x.id===item.id);
    if(idx>=0) data[idx] = edited;

    closeModal(backdrop);
    // re-run current view
    const applyBtn = document.getElementById('apply');
    if(applyBtn) applyBtn.click();
  });
}

function escapeHtml(str){
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function getStoredEdits(){
  try{
    const raw = localStorage.getItem('menu_edits');
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}

function saveStoredEdits(map){
  localStorage.setItem('menu_edits', JSON.stringify(map));
}

function scoreItem(item, {weather, feel, budget, category, styles}){
  let score = 0;
  const tags = (item.tags||[]).map(t=>t.toLowerCase());
  const cat = (item.category||'').toLowerCase();
  const price = item.price||0;

  if(category && cat === category.toLowerCase()) score += 20;
  if(styles && styles.length){
    styles.forEach(s=>{ if(tags.includes(s.toLowerCase())) score += 10 });
  }

  if(weather){
    const w = weather.toLowerCase();
    if(w === 'hot'){
      if(tags.includes('salad')||tags.includes('grilled')) score += 10;
      if(cat === 'staple' || tags.includes('soup')) score -= 2;
    } else if(w === 'cold'){
      if(tags.includes('stew')||tags.includes('soup')||cat==='soup') score += 10;
      if(tags.includes('salad')) score -= 2;
    } else if(w === 'rainy'){
      if(tags.includes('grilled')||tags.includes('stew')||tags.includes('fried')) score += 8;
    }
  }

  if(feel){
    const f = feel.toLowerCase();
    if(f === 'comfort'){
      if(cat === 'staple' || tags.includes('stew')) score += 8;
    } else if(f === 'festive' || f === 'celebration'){
      if(tags.includes('spicy')||tags.includes('contains-fish')) score += 6;
    } else if(f === 'light' || f === 'refreshing'){
      if(tags.includes('salad')||cat==='starter'||tags.includes('vegan')) score += 8;
    }
  }

  if(budget){
    const asNum = Number(budget);
    if(!Number.isNaN(asNum)){
      if(price > asNum) return -9999;
      else score += 5;
    } else {
      const b = budget.toLowerCase();
      if(b === 'cheap'){
        if(price <= 10000) score += 5; else score -= 10;
      } else if(b === 'medium'){
        if(price > 10000 && price <= 30000) score += 5;
      } else if(b === 'expensive'){
        if(price > 30000) score += 5;
      }
    }
  }

  if(feel && (feel.toLowerCase()=== 'light' || feel.toLowerCase()==='refreshing')){
    if((item.spice_level||0) >= 3) score -= 5;
  }

  return score;
}

function filterAndRank(items, opts){
  const scored = items.map(it=>({it, score: scoreItem(it, opts)})).filter(s=>s.score>-1000);
  scored.sort((a,b)=>{
    if(b.score !== a.score) return b.score - a.score;
    // tie-break: lower price first
    return (a.it.price||0) - (b.it.price||0);
  });
  const out = scored.map(s=>s.it);
  if(opts.topn) return out.slice(0, opts.topn);
  return out;
}

function renderCard(item, lang, explanation){
  const name = (item.name && (item.name[lang] || item.name.en)) || '—';
  const desc = (item.description && (item.description[lang] || item.description.en)) || '';
  const price = item.price ? `${item.price} ${item.currency||'LAK'}` : '';
  const cat = item.category || '';
  const el = document.createElement('div');
  el.className = 'card';

  // prepare images array: prefer override list in localStorage, then item.images, then item.image
  const overrideKey = `image_override_${item.id}`;
  const overrideVal = (typeof window !== 'undefined') ? localStorage.getItem(overrideKey) : null;
  let images = [];
  if(overrideVal){
    // allow comma-separated list in override
    images = overrideVal.split(',').map(s=>s.trim()).filter(Boolean);
  } else if(Array.isArray(item.images) && item.images.length){
    images = item.images.slice();
  } else if(item.image){
    images = [item.image];
  }

  // ordinal words to display on images (friendly labels)
  const ORDINALS = ['First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth','Tenth','Eleventh','Twelfth'];

  // build carousel markup
  let carouselHtml = '';
  if(images.length){
    const first = images[0];
    const firstLabel = ORDINALS[0] || '1st';
    carouselHtml = `
      <div class="img-carousel" data-total="${images.length}" data-index="0">
        <img src="${first}" alt="${name}" />
        ${images.length>1 ? '<button class="nav prev">‹</button><button class="nav next">›</button>' : ''}
        <div class="counter">1 / ${images.length}</div>
        <div class="img-order">${firstLabel}</div>
      </div>
    `;
  } else {
    carouselHtml = `<div class="image-placeholder" data-name="${encodeURIComponent(name)}" style="margin-bottom:8px;padding:18px;background:#f6f7fb;border-radius:8px;text-align:center;color:#94a3b8">Loading image…</div>`;
  }

  el.innerHTML = `
    ${carouselHtml}
    <div class="meta">${cat} • ${price}</div>
    <div class="title">${name}</div>
    <div class="desc">${desc}</div>
    <div class="explain">${explanation}</div>
  `;

  // if no images available yet, try to fetch via the optional proxy
  if(images.length === 0){
    const placeholder = el.querySelector('.image-placeholder');
    if(placeholder){
      const decodedName = decodeURIComponent(placeholder.getAttribute('data-name'));
      // call proxy
      fetch(IMAGE_PROXY_BASE + encodeURIComponent(decodedName))
        .then(r=>r.json())
        .then(j=>{
          if(j && j.image){
            const img = document.createElement('img');
            img.src = j.image;
            img.alt = name;
            img.style.width = '100%';
            img.style.borderRadius = '8px';
            img.style.objectFit = 'cover';
            img.style.maxHeight = '160px';
            placeholder.replaceWith(img);
          } else {
            placeholder.textContent = 'No image found';
            placeholder.style.color = '#cbd5e1';
          }
        })
        .catch(()=>{
          placeholder.textContent = 'Image unavailable';
          placeholder.style.color = '#cbd5e1';
        });
    }
  }

  // If there's an override URL (handled above), nothing else to do; else if there's no images we may try proxy
  const carousel = el.querySelector('.img-carousel');
  if(carousel){
    const imgEl = carousel.querySelector('img');
    const total = Number(carousel.getAttribute('data-total')) || 1;
    let idx = Number(carousel.getAttribute('data-index')) || 0;
    // helper to set image by index
    const setIndex = (i)=>{
      idx = (i + total) % total;
      carousel.setAttribute('data-index', idx);
      imgEl.src = images[idx];
      const counter = carousel.querySelector('.counter');
      if(counter) counter.textContent = `${idx+1} / ${total}`;
      const orderEl = carousel.querySelector('.img-order');
      if(orderEl){
        const label = ORDINALS[idx] || `${idx+1}${((idx+1)%10===1 && (idx+1)!==11)?'st':((idx+1)%10===2 && (idx+1)!==12)?'nd':((idx+1)%10===3 && (idx+1)!==13)?'rd':'th'}`;
        orderEl.textContent = label;
      }
    };
    // attach nav
    const prev = carousel.querySelector('.nav.prev');
    const next = carousel.querySelector('.nav.next');
    if(prev) prev.addEventListener('click', ()=> setIndex(idx-1));
    if(next) next.addEventListener('click', ()=> setIndex(idx+1));
  } else {
    // no carousel (no images): try proxy if available
    const placeholder = el.querySelector('.image-placeholder');
    if(placeholder){
      const decodedName = decodeURIComponent(placeholder.getAttribute('data-name'));
      fetch(IMAGE_PROXY_BASE + encodeURIComponent(decodedName))
        .then(r=>r.json())
        .then(j=>{
          if(j && j.image){
            const img = document.createElement('img');
            img.src = j.image;
            img.alt = name;
            img.style.width = '100%';
            img.style.borderRadius = '8px';
            img.style.objectFit = 'cover';
            img.style.maxHeight = '160px';
            placeholder.replaceWith(img);
          } else {
            placeholder.textContent = 'No image found';
            placeholder.style.color = '#cbd5e1';
          }
        })
        .catch(()=>{
          placeholder.textContent = 'Image unavailable';
          placeholder.style.color = '#cbd5e1';
        });
    }
  }

  // image edit actions: allow pasting a URL to override or reset
  const actions = document.createElement('div');
  actions.className = 'img-actions';
  actions.innerHTML = `
    <button class="tiny" data-action="set"></button>
    <button class="tiny" data-action="reset"></button>
  `;
  el.appendChild(actions);

  // edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'tiny';
  editBtn.style.marginLeft = '8px';
  editBtn.textContent = 'Edit';
  actions.appendChild(editBtn);
  editBtn.addEventListener('click', ()=> openEditModal(item));

    actions.querySelector('[data-action="set"]').addEventListener('click', ()=>{
    const url = prompt('Paste image URL (single or comma-separated list to create a carousel):');
    if(url){
      // save override and trigger a re-render so carousel is rebuilt from override list
      localStorage.setItem(overrideKey, url);
      const applyBtn = document.getElementById('apply');
      if(applyBtn) applyBtn.click();
    }
  });

    actions.querySelector('[data-action="reset"]').addEventListener('click', ()=>{
    localStorage.removeItem(overrideKey);
    const applyBtn = document.getElementById('apply');
    if(applyBtn) applyBtn.click();
  });

  return el;
}

function explainMatch(item, opts){
  const parts = [];
  if(opts.category && (item.category||'').toLowerCase() === opts.category.toLowerCase()) parts.push('Category match');
  const tags = (item.tags||[]).map(t=>t.toLowerCase());
  if(opts.styles && opts.styles.length){
    const matched = opts.styles.filter(s=>tags.includes(s.toLowerCase()));
    if(matched.length) parts.push('Style: ' + matched.join(', '));
  }
  if(opts.weather){
    if(opts.weather === 'hot' && (tags.includes('salad')||tags.includes('grilled'))) parts.push('Good for hot weather');
    if(opts.weather === 'cold' && (tags.includes('stew')||tags.includes('soup'))) parts.push('Comforting for cold weather');
    if(opts.weather === 'rainy' && (tags.includes('grilled')||tags.includes('stew'))) parts.push('Warm choice for rainy weather');
  }
  if(opts.feel){
    const f = opts.feel.toLowerCase();
    if(f==='light' && (tags.includes('salad')||item.category==='Starter')) parts.push('Light & refreshing');
    if(f==='comfort' && (item.category==='Staple' || tags.includes('stew'))) parts.push('Comfort food');
  }
  if(opts.budget){
    const asNum = Number(opts.budget);
    if(!Number.isNaN(asNum)){
      if(item.price <= asNum) parts.push(`Within budget (${opts.budget})`);
    } else {
      parts.push('Budget preference: ' + opts.budget);
    }
  }
  if(parts.length===0) return 'Matched by general suitability';
  return parts.join(' · ');
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const data = await loadData();
  const apply = document.getElementById('apply');
  const reset = document.getElementById('reset');
  const list = document.getElementById('list');

  function readOpts(){
    const lang = document.getElementById('lang').value;
    const weather = document.getElementById('weather').value || null;
    const feel = document.getElementById('feel').value || null;
    const budget = document.getElementById('budget').value || null;
    const category = document.getElementById('category').value || null;
    const stylesRaw = document.getElementById('styles').value || '';
    const styles = stylesRaw.split(',').map(s=>s.trim()).filter(Boolean);
    const topn = parseInt(document.getElementById('topn').value) || null;
    return {lang, weather, feel, budget, category, styles, topn};
  }

  function run(){
    const opts = readOpts();
    const results = filterAndRank(data, opts);
    list.innerHTML = '';
    if(results.length===0){
      list.innerHTML = '<div class="card">No items matched your filters.</div>';
      return;
    }
    results.forEach(it=>{
      const explanation = explainMatch(it, opts);
      list.appendChild(renderCard(it, opts.lang, explanation));
    });
  }

  apply.addEventListener('click', run);
  reset.addEventListener('click', ()=>{
    document.getElementById('filters').reset();
    document.getElementById('topn').value = '';
    list.innerHTML = '';
  });

  // Load stored edits and merge them into data
  const storedEdits = getStoredEdits();
  if(storedEdits && Object.keys(storedEdits).length){
    data = data.map(it => storedEdits[it.id] ? storedEdits[it.id] : it);
  }

  // Export current dataset (applies image overrides and stored edits)
  const exportBtn = document.getElementById('export');
  if(exportBtn){
    exportBtn.addEventListener('click', ()=>{
      const editsMap = getStoredEdits();
      const out = data.map(it => {
        const copy = JSON.parse(JSON.stringify(it));
        // apply edit if exists
        if(editsMap[it.id]){
          Object.assign(copy, editsMap[it.id]);
        }
        // apply image override
        const override = localStorage.getItem(`image_override_${it.id}`);
        if(override) copy.image = override;
        return copy;
      });
      const blob = new Blob([JSON.stringify(out, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'menu_export.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    });
  }

  // initial render: show all in English
  run();
});
