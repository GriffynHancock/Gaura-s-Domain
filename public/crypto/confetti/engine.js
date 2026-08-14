/* ===== shared victory-effects (confetti) engine =====
   Used by every crypto module. Include order on a page:
     <script src="../confetti/manifest.js"></script>      // sets window.CONFETTI
     <script>window.FX_MODULE='caesar';                    // module id for the per-user seed
             window.FX_TOTAL=7;</script>                   // number of main puzzles in the module
     <script src="../confetti/engine.js"></script>
   Then call window.fxSolved(id) as EACH puzzle is captured (id = any stable per-puzzle key).
   Set window.FX_NO_PUZZLES=true instead of FX_TOTAL for a module with nothing to capture.

   The rain is the MODULE-COMPLETION reward: it fires once, only after all FX_TOTAL puzzles
   are solved — so students tutor each other to finish and see each person's meme.
   (window.fxVictory() still fires the effect directly, for manual/testing use.)

   Each user gets ONE signature effect per module, seeded from a cookie id — completion always
   rains the same thing for that person, but different people (and other modules) differ.
   Sprites are resolved relative to THIS script, so it works from any page depth. */
(function(){
  const BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || '';
  const SPRITES = window.CONFETTI || [];
  const EFFECTS = [{type:'classic', name:'classic'}]
    .concat(SPRITES.map(f=>({type:'sprite', src:BASE+f, name:f.replace(/\.png$/,'')})));
  const COLORS=['#b23a26','#a9772a','#3f7d52','#e0593d','#c79338','#62ab77','#f0bb4d','#efe7d3'];

  const cv=document.createElement('canvas');
  cv.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(cv);
  const ctx=cv.getContext('2d');
  const fit=()=>{ cv.width=innerWidth; cv.height=innerHeight; };
  fit(); addEventListener('resize',fit);

  const cache={};
  const img=src=>{ if(!cache[src]){ const i=new Image(); i.src=src; cache[src]=i; } return cache[src]; };
  SPRITES.forEach(f=>img(BASE+f));   // warm the cache

  let parts=[], emitters=[], raf=null, frame=0;
  function mkPart(sprite, big){
    return { x:Math.random()*cv.width, y:-40-Math.random()*cv.height*0.2,
      vx:(Math.random()-0.5)*(big?1.2:4),
      vy:(big?0.3:0.6)+Math.random()*(big?0.3:1.4),     // ~half the old fall speed
      grav: big?0.006:0.03,
      rot:Math.random()*6.28, vr:(Math.random()-0.5)*(big?0.04:0.3),
      sz: big ? Math.min(cv.width*0.42, cv.height*0.42, 240)
              : (sprite ? 24+Math.random()*26 : 6+Math.random()*8),
      color:COLORS[(Math.random()*COLORS.length)|0], sprite, big, life:0,
      ttl: big ? 4000 : 420+Math.random()*160 };
  }
  function spawn(effect){
    const sprite = effect.type==='sprite' ? img(effect.src) : null;
    emitters.push({ sprite, left: sprite?60:180, per: sprite?1:3 });   // stream over ~60 frames
    emitters.push({ sprite, big:true, left:1, per:1, delay:120 });       // slow giant finale
    if(!raf){ frame=0; raf=requestAnimationFrame(tick); }
  }
  function tick(){
    frame++;
    ctx.clearRect(0,0,cv.width,cv.height);
    for(const em of emitters){
      if(em.delay && frame<em.delay) continue;
      let n=Math.min(em.per, em.left);
      while(n-->0){ parts.push(mkPart(em.sprite, em.big)); em.left--; }
    }
    emitters=emitters.filter(em=>em.left>0);
    parts=parts.filter(p=>p.life<p.ttl && p.y<cv.height+140);
    for(const p of parts){
      p.life++; p.vy+=p.grav; p.x+=p.vx+Math.sin((p.life+p.rot)*0.06)*(p.big?0.4:0.7); p.y+=p.vy; p.rot+=p.vr;
      const a=p.life>p.ttl-60?(p.ttl-p.life)/60:1;
      ctx.save(); ctx.globalAlpha=Math.max(0,a); ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      if(p.sprite && p.sprite.complete && p.sprite.naturalWidth) ctx.drawImage(p.sprite,-p.sz/2,-p.sz/2,p.sz,p.sz);
      else { ctx.fillStyle=p.color; ctx.fillRect(-p.sz/2,-p.sz*0.35,p.sz,p.sz*0.7); }
      ctx.restore();
    }
    raf = (parts.length||emitters.length) ? requestAnimationFrame(tick) : (ctx.clearRect(0,0,cv.width,cv.height), null);
  }

  function uid(){
    const m=document.cookie.match(/(?:^|; )ctf-uid=([^;]+)/);
    if(m) return m[1];
    const id=Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
    document.cookie='ctf-uid='+id+';path=/;max-age=31536000;samesite=lax';
    return id;
  }
  const fnv=s=>{ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; };
  const MODULE = window.FX_MODULE || 'module';
  const myIndex = EFFECTS.length ? fnv(uid()+':'+MODULE)%EFFECTS.length : 0;

  window.fxVictory = ()=> spawn(EFFECTS[myIndex]);   // fire the signature rain directly (manual/testing)
  window.fxEffects = EFFECTS;
  window.fxPlay = i => spawn(EFFECTS[((i%EFFECTS.length)+EFFECTS.length)%EFFECTS.length]);

  // Module-completion reward: the rain only fires once EVERY main puzzle is solved.
  // Progress persists in localStorage (per module), so completion survives reloads and the
  // rain fires on the final solve even across sessions. Page calls window.fxSolved(id) per
  // capture, reads window.fxSolvedSet() to restore solved UI, and window.fxReset() to clear.
  // NOTE the ':v2' — the solve-id scheme changed (cipher -> stable id); v2 ignores stale data.
  const STORE = 'ctf-solved:v2:' + MODULE;
  const load = ()=>{ try{ return new Set(JSON.parse(localStorage.getItem(STORE) || '[]')); }catch(e){ return new Set(); } };
  const solved = load();

  // A module with no capturable flags at all (the hash module) is vacuously complete — its
  // confetti button ships unlocked. This is an explicit per-page OPT-IN, never inferred from
  // FX_TOTAL being 0/unset: caesar computes FX_TOTAL from a DOM query, and a selector that ever
  // returned 0 would otherwise silently light the star on a real puzzle module.
  const NO_PUZZLES = !!window.FX_NO_PUZZLES;
  const isComplete = ()=> NO_PUZZLES || !!(window.FX_TOTAL && solved.size >= window.FX_TOTAL);
  let celebrated = isComplete();   // already done -> don't re-rain on load

  // Completion state for the page chrome. Each module page renders ONE always-present confetti
  // button in its header (lock icon while incomplete, star once complete); the engine owns the
  // store key, so pages must ask here rather than re-reading localStorage themselves. The engine
  // no longer injects any button of its own.
  //   window.fxIsComplete()  -> boolean, safe to call any time after this script has run
  //   document 'fx:state'    -> fired at init, on the completing solve, and on reset;
  //                             detail:{complete}. Pages register the listener BEFORE this
  //                             script (it is the last script on every page), so the init
  //                             dispatch always reaches them.
  window.fxIsComplete = isComplete;
  window.fxReplay = ()=> spawn(EFFECTS[myIndex]);
  const emitState = ()=>{ try{ document.dispatchEvent(new CustomEvent('fx:state',{detail:{complete:isComplete()}})); }catch(e){} };

  window.fxSolved = (id)=>{
    if(!solved.has(id)){ solved.add(id); try{ localStorage.setItem(STORE, JSON.stringify([...solved])); }catch(e){} }
    const total = window.FX_TOTAL || 0;
    if(total && solved.size >= total && !celebrated){ celebrated = true; spawn(EFFECTS[myIndex]); emitState(); }
  };
  window.fxSolvedSet = ()=> [...solved];
  window.fxReset = ()=>{ solved.clear(); celebrated = NO_PUZZLES; try{ localStorage.removeItem(STORE); }catch(e){} emitState(); };

  emitState();   // initial lock-vs-star state for the page chrome
})();
