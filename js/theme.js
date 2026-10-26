document.addEventListener('DOMContentLoaded', function() {
  const themeToggle = document.getElementById('themeToggle');
  const htmlEl = document.documentElement;
  
  function applyTheme(theme) {
    htmlEl.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const themeToggle = document.getElementById('themeToggle');
    if (!themeToggle) return;
    
    if (theme === 'dark') {
      themeToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>`;
    } else {
      themeToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }
  }
  
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(systemTheme);
  }
  
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  });

  const musicToggle = document.getElementById('musicToggle');
  const audio = document.getElementById('backgroundMusic');
  
  if (!audio) {
    console.log('音频元素不存在');
  }
  
  let isAudioUnlocked = false;
  let isShuffle = false;
  let currentIndex = 0;
  let musicFiles = window.musicFiles || ['./images/music/background.mp3'];
  
  function updateMusicIcon(isPlaying) {
    const musicToggle = document.getElementById('musicToggle');
    if (!musicToggle) return;
    
    if (isPlaying) {
      musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    } else {
      musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle><path d="M2 2l20 20"></path></svg>`;
    }
  }
  
  const savedMusicTime = localStorage.getItem('musicTime');
  const savedMusicIndex = localStorage.getItem('musicIndex');
  const savedMusicShuffle = localStorage.getItem('musicShuffle') === 'true';
  
  if (savedMusicIndex !== null && savedMusicIndex < musicFiles.length) {
    currentIndex = parseInt(savedMusicIndex);
  }
  isShuffle = savedMusicShuffle;
  
  if (audio && musicFiles[currentIndex]) {
    audio.src = musicFiles[currentIndex];
    if (savedMusicTime) {
      audio.currentTime = parseFloat(savedMusicTime);
    }
  }
  
  function getIsPlaying() {
    return audio && !audio.paused;
  }
  
  function playNextSong() {
    if (musicFiles.length <= 1) return;
    
    if (isShuffle) {
      let newIndex;
      do {
        newIndex = Math.floor(Math.random() * musicFiles.length);
      } while (newIndex === currentIndex && musicFiles.length > 1);
      currentIndex = newIndex;
    } else {
      currentIndex = (currentIndex + 1) % musicFiles.length;
    }
    
    if (audio && musicFiles[currentIndex]) {
      audio.src = musicFiles[currentIndex];
      audio.currentTime = 0;
      if (!audio.paused) {
        audio.play().catch(function(error) {
          console.log('播放下一首失败:', error);
        });
      }
      saveMusicState();
    }
  }
  
  function toggleShuffle() {
    isShuffle = !isShuffle;
    saveMusicState();
    showShuffleHint(isShuffle);
  }
  
  function showShuffleHint(shuffle) {
    const hint = document.createElement('div');
    hint.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(67, 97, 238, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 14px;
      z-index: 1000;
      animation: fadeInUp 0.5s ease;
      box-shadow: 0 4px 15px rgba(67, 97, 238, 0.3);
      pointer-events: none;
    `;
    hint.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 8px;"><path d="M16 3h5v5M4 20h-5v-5M20 20h5v-5M15 3h-5v5M3 3l18 18"></path></svg>${shuffle ? '已开启随机播放' : '已关闭随机播放'}`;
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(hint);
    
    setTimeout(function() {
      hint.style.transition = 'opacity 0.5s ease';
      hint.style.opacity = '0';
      setTimeout(function() {
        hint.remove();
        style.remove();
      }, 500);
    }, 2000);
  }
  
  function showUnmuteHint() {
    if (isAudioUnlocked) return;
    
    const hint = document.createElement('div');
    hint.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(67, 97, 238, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 25px;
      font-size: 14px;
      z-index: 1000;
      animation: fadeInUp 0.5s ease;
      box-shadow: 0 4px 15px rgba(67, 97, 238, 0.3);
      pointer-events: none;
    `;
    hint.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 8px;"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>点击任意位置开启音乐声音，双击音乐图标切换随机播放';
    
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(hint);
    
    setTimeout(function() {
      hint.style.transition = 'opacity 0.5s ease';
      hint.style.opacity = '0';
      setTimeout(function() {
        hint.remove();
        style.remove();
      }, 500);
    }, 3000);
  }
  
  function unlockAudio() {
    if (isAudioUnlocked || !audio) return;
    
    isAudioUnlocked = true;
    audio.muted = false;
    audio.volume = 0.3;
    
    if (audio.paused) {
      audio.play().then(function() {
        updateMusicIcon(true);
        saveMusicState();
      }).catch(function(error) {
        console.log('播放失败:', error);
      });
    }
  }
  
  if (audio) {
    audio.addEventListener('ended', function() {
      playNextSong();
    });
  }
  
  setTimeout(function() {
    updateMusicIcon(getIsPlaying());
    
    if (audio && audio.muted) {
      showUnmuteHint();
    }
  }, 500);
  
  document.addEventListener('click', function() {
    unlockAudio();
  }, { once: true });
  
  document.addEventListener('touchstart', function() {
    unlockAudio();
  }, { once: true });

  function saveMusicState() {
    if (!audio) return;
    localStorage.setItem('musicTime', audio.currentTime);
    localStorage.setItem('musicPlaying', !audio.paused);
    localStorage.setItem('musicIndex', currentIndex);
    localStorage.setItem('musicShuffle', isShuffle);
  }

  setInterval(saveMusicState, 500);

  window.addEventListener('beforeunload', saveMusicState);

  if (musicToggle) {
    let lastClickTime = 0;
    
    musicToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      
      if (!audio) return;
      
      const currentTime = Date.now();
      const timeDiff = currentTime - lastClickTime;
      
      if (timeDiff < 300) {
        toggleShuffle();
        lastClickTime = 0;
        return;
      }
      
      lastClickTime = currentTime;
      
      unlockAudio();
      
      if (audio.paused) {
        audio.play().then(function() {
          updateMusicIcon(true);
          saveMusicState();
        }).catch(function(error) {
          console.log('播放被阻止:', error);
        });
      } else {
        audio.pause();
        updateMusicIcon(false);
        saveMusicState();
      }
    });
  }

  function setupSPAApp() {
    const allLinks = document.querySelectorAll('a');
    
    allLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || this.hasAttribute('download') || this.target === '_blank') return;
        
        if (!href) return;
        const destination = new URL(href, window.location.href);
        if (!['http:', 'https:'].includes(destination.protocol) || destination.origin !== window.location.origin) return;
        if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.hash) return;
        e.preventDefault();
        loadPage(destination.href);
      });
    });
  }

  function loadPage(url, pushHistory = true) {
    const destination = new URL(url, window.location.href);
    fetch(destination.href, { cache: 'no-cache' })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const newBody = doc.querySelector('body');
        const newHead = doc.querySelector('head');
        
        if (newBody && newHead) {
          saveMusicState();
          
          const newTitle = newHead.querySelector('title');
          if (newTitle) {
            document.title = newTitle.textContent;
          }
          
          // 每次切换都替换页面独有样式，目标页面没有 style 时也清理旧样式。
          document.head.querySelectorAll('style').forEach(style => style.remove());
          newHead.querySelectorAll('style').forEach(style => document.head.appendChild(style.cloneNode(true)));

          // 相对样式路径以目标页面为准，并清除上一页专用的外部样式。
          const stylesheets = [...newHead.querySelectorAll('link[rel="stylesheet"]')].map(link => {
            const copy = link.cloneNode(true);
            copy.href = new URL(link.getAttribute('href'), destination.href).href;
            return copy;
          });
          const stylesheetURLs = new Set(stylesheets.map(link => link.href));
          document.head.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            if (!stylesheetURLs.has(link.href)) link.remove();
            // 固定为绝对路径，避免 history 更新后相对引用指向错误目录。
            else link.setAttribute('href', link.href);
          });
          stylesheets.forEach(link => {
            if (![...document.head.querySelectorAll('link[rel="stylesheet"]')].some(existing => existing.href === link.href)) document.head.appendChild(link);
          });
          
          document.body.innerHTML = newBody.innerHTML;
          document.body.className = newBody.className;
          if (audio) {
            document.getElementById('backgroundMusic')?.remove();
            document.body.appendChild(audio);
          }
          
          if (pushHistory) history.pushState({}, '', url);
          
          initializePage();
          const anchor = destination.hash && document.getElementById(decodeURIComponent(destination.hash.slice(1)));
          if (anchor) anchor.scrollIntoView();
          else window.scrollTo(0, 0);
        }
      })
      .catch(error => {
        console.error('加载页面失败:', error);
        window.location.href = url;
      });
  }

  function initializePage() {
    const themeToggle = document.getElementById('themeToggle');
    const musicToggle = document.getElementById('musicToggle');
    
    const currentTheme = htmlEl.getAttribute('data-theme');
    if (themeToggle) {
      if (currentTheme === 'dark') {
        themeToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>`;
      } else {
        themeToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
      }
      
      themeToggle.addEventListener('click', () => {
        const currentTheme = htmlEl.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(newTheme);
      });
    }
    
    if (musicToggle) {
      updateMusicIcon(getIsPlaying());
      
      let lastClickTime = 0;
      
      musicToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        
        if (!audio) return;
        
        const currentTime = Date.now();
        const timeDiff = currentTime - lastClickTime;
        
        if (timeDiff < 300) {
          toggleShuffle();
          lastClickTime = 0;
          return;
        }
        
        lastClickTime = currentTime;
        
        unlockAudio();
        
        if (audio.paused) {
          audio.play().then(function() {
            updateMusicIcon(true);
            saveMusicState();
          }).catch(function(error) {
            console.log('播放被阻止:', error);
          });
        } else {
          audio.pause();
          updateMusicIcon(false);
          saveMusicState();
        }
      });
    }
    
    setupSPAApp();
    initializeNavigation();
    setupBackToTop();
    initializeHighlightJs();
    initializeGiscus();
  }
  
  function initializeHighlightJs() {
    if (!document.querySelector('.post-body pre code')) return;
    if (typeof hljs !== 'undefined') {
      hljs.highlightAll();
    } else {
      const hljsScript = document.createElement('script');
      hljsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js';
      hljsScript.onload = function() {
        hljs.highlightAll();
      };
      document.head.appendChild(hljsScript);
    }
  }

  function initializeGiscus() {
    const commentsContainer = document.getElementById('comments');
    if (commentsContainer) {
      const existingScripts = commentsContainer.querySelectorAll('script');
      existingScripts.forEach(script => script.remove());
      
      const giscusScript = document.createElement('script');
      giscusScript.src = 'https://giscus.app/client.js';
      giscusScript.setAttribute('data-repo', 'jonny-dr/jonny-dr.github.io');
      giscusScript.setAttribute('data-repo-id', 'R_kgDORKkzfg');
      giscusScript.setAttribute('data-category', 'Announcements');
      giscusScript.setAttribute('data-category-id', 'DIC_kwDORKkzfs4C2Wdq');
      giscusScript.setAttribute('data-mapping', 'pathname');
      giscusScript.setAttribute('data-strict', '0');
      giscusScript.setAttribute('data-reactions-enabled', '1');
      giscusScript.setAttribute('data-emit-metadata', '0');
      giscusScript.setAttribute('data-input-position', 'bottom');
      giscusScript.setAttribute('data-theme', 'preferred_color_scheme');
      giscusScript.setAttribute('data-lang', 'zh-CN');
      giscusScript.setAttribute('crossorigin', 'anonymous');
      giscusScript.setAttribute('async', '');
      
      commentsContainer.appendChild(giscusScript);
    }
  }

  window.addEventListener('popstate', function() {
    const currentUrl = window.location.href;
    const path = currentUrl.replace(window.location.origin, '');
    
    loadPage(path || '/', false);
  });

  function updateBackToTop() {
    document.getElementById('backToTop')?.classList.toggle('visible', window.pageYOffset > 300);
  }

  function setupBackToTop() {
    const backToTopBtn = document.getElementById('backToTop');
    
    if (backToTopBtn) {
      window.removeEventListener('scroll', updateBackToTop);
      window.addEventListener('scroll', updateBackToTop, { passive: true });
      updateBackToTop();
      
      backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
  }

  function initializeNavigation() {
    const moduleMatch = window.location.pathname.match(/\/(?:html|posts)\/(skill|ai|project|daily)\//);
    const currentPath = moduleMatch
      ? `/html/${moduleMatch[1]}/${moduleMatch[1]}.html`
      : /^\/archives(?:-\d+)?\.html$/.test(window.location.pathname) ? '/archives.html'
      : window.location.pathname === '/' ? '/index.html' : window.location.pathname;
    document.querySelectorAll('header nav a').forEach(link => {
      if (new URL(link.href).pathname === currentPath && new URL(link.href).origin === window.location.origin) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    const categories = document.querySelector('.skill-category-nav');
    const active = categories && categories.querySelector('[aria-current="page"]');
    if (active && categories.scrollWidth > categories.clientWidth) {
      categories.scrollLeft += active.getBoundingClientRect().left - categories.getBoundingClientRect().left - (categories.clientWidth - active.offsetWidth) / 2;
    }
  }

  initializeNavigation();
  setupSPAApp();
  setupBackToTop();
});
