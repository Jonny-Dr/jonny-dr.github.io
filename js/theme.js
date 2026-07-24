document.addEventListener('DOMContentLoaded', function() {
  const themeToggle = document.getElementById('themeToggle');
  const htmlEl = document.documentElement;
  
  const savedTheme = localStorage.getItem('theme') || 
                    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (savedTheme === 'dark') {
    htmlEl.setAttribute('data-theme', 'dark');
    themeToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>`;
  }
  
  themeToggle.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    htmlEl.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark') {
      themeToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>`;
    } else {
      themeToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    }
  });

  document.addEventListener('copy', function(e) {
    e.preventDefault();
    alert('复制功能已禁用');
  });

  document.addEventListener('cut', function(e) {
    e.preventDefault();
    alert('剪切功能已禁用');
  });

  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    alert('右键菜单已禁用');
  });

  const musicToggle = document.getElementById('musicToggle');
  
  const audio = new Audio('/images/music/background.mp3');
  audio.loop = true;
  audio.volume = 0.3;
  
  const savedMusicTime = localStorage.getItem('musicTime');
  const savedMusicPlaying = localStorage.getItem('musicPlaying') === 'true';
  
  if (savedMusicTime) {
    audio.currentTime = parseFloat(savedMusicTime);
  }
  
  if (savedMusicPlaying) {
    audio.play().catch(function(error) {
      console.log('自动播放被阻止:', error);
    });
    musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
  } else {
    audio.play().catch(function(error) {
      console.log('自动播放被阻止:', error);
    });
    musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
  }

  function saveMusicState() {
    localStorage.setItem('musicTime', audio.currentTime);
    localStorage.setItem('musicPlaying', !audio.paused);
  }

  setInterval(saveMusicState, 500);

  window.addEventListener('beforeunload', saveMusicState);

  musicToggle.addEventListener('click', function() {
    if (audio.paused) {
      audio.play().catch(function(error) {
        console.log('播放被阻止:', error);
      });
      musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
    } else {
      audio.pause();
      musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle><path d="M2 2l20 20"></path></svg>`;
    }
    saveMusicState();
  });

  function setupSPAApp() {
    const allLinks = document.querySelectorAll('a');
    
    allLinks.forEach(link => {
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          e.preventDefault();
          loadPage(href);
        }
      });
    });
  }

  function loadPage(url) {
    fetch(url)
      .then(response => response.text())
      .then(html => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const newBody = doc.querySelector('body');
        const newHead = doc.querySelector('head');
        
        if (newBody && newHead) {
          saveMusicState();
          
          const isPlaying = !audio.paused;
          
          const newTitle = newHead.querySelector('title');
          if (newTitle) {
            document.title = newTitle.textContent;
          }
          
          const newStyles = newHead.querySelectorAll('style');
          if (newStyles.length > 0) {
            const existingStyles = document.querySelectorAll('style');
            existingStyles.forEach(style => {
              style.remove();
            });
            
            newStyles.forEach(style => {
              document.head.appendChild(style.cloneNode(true));
            });
          }
          
          document.body.innerHTML = newBody.innerHTML;
          
          history.pushState({}, '', url);
          
          initializePage();
          
          if (isPlaying && !audio.paused) {
          } else if (isPlaying) {
            audio.play().catch(function(error) {
              console.log('自动播放被阻止:', error);
            });
          }
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
    
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const htmlEl = document.documentElement;
        const currentTheme = htmlEl.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        htmlEl.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        if (newTheme === 'dark') {
          themeToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path></svg>`;
        } else {
          themeToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
        }
      });
    }
    
    if (musicToggle) {
      musicToggle.addEventListener('click', function() {
        if (audio.paused) {
          audio.play().catch(function(error) {
            console.log('播放被阻止:', error);
          });
          musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
        } else {
          audio.pause();
          musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle><path d="M2 2l20 20"></path></svg>`;
        }
        saveMusicState();
      });
    }
    
    setupSPAApp();
    setupBackToTop();
    initializeHighlightJs();
    initializeGiscus();
  }
  
  function initializeHighlightJs() {
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
    
    loadPage(path || '/');
  });

  function setupBackToTop() {
    const backToTopBtn = document.getElementById('backToTop');
    
    if (backToTopBtn) {
      window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
          backToTopBtn.classList.add('visible');
        } else {
          backToTopBtn.classList.remove('visible');
        }
      });
      
      backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
  }

  setupSPAApp();
  setupBackToTop();
});