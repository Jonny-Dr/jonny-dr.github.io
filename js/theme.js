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

  // 阻止复制事件
  document.addEventListener('copy', function(e) {
    e.preventDefault();
    alert('复制功能已禁用');
  });

  // 阻止剪切事件
  document.addEventListener('cut', function(e) {
    e.preventDefault();
    alert('剪切功能已禁用');
  });

  // 阻止右键菜单
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    alert('右键菜单已禁用');
  });

  // 背景音乐控制
  const musicToggle = document.getElementById('musicToggle');
  
  // 使用绝对路径，确保所有页面都能正确找到音频文件
  const audio = new Audio('/images/music/background.mp3');
  audio.loop = true;
  audio.volume = 0.3;
  
  // 从localStorage恢复播放状态
  const savedMusicTime = localStorage.getItem('musicTime');
  const savedMusicPlaying = localStorage.getItem('musicPlaying') === 'true';
  
  if (savedMusicTime) {
    audio.currentTime = parseFloat(savedMusicTime);
  }
  
  // 尝试恢复播放状态（尽可能快地执行）
  if (savedMusicPlaying) {
    audio.play().catch(function(error) {
      console.log('自动播放被阻止:', error);
    });
    musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
  } else {
    // 默认尝试自动播放
    audio.play().catch(function(error) {
      console.log('自动播放被阻止:', error);
    });
    musicToggle.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;
  }

  // 存储播放状态
  function saveMusicState() {
    localStorage.setItem('musicTime', audio.currentTime);
    localStorage.setItem('musicPlaying', !audio.paused);
  }

  // 定期保存播放状态
  setInterval(saveMusicState, 500); // 每500毫秒保存一次，比之前更频繁

  // 页面卸载时保存播放状态
  window.addEventListener('beforeunload', saveMusicState);

  // 控制音乐播放/暂停
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
    // 保存播放状态
    saveMusicState();
  });

  // 单页应用效果：通过AJAX加载页面内容，防止页面刷新
  function setupSPAApp() {
    // 获取所有站内链接（包括导航链接和文章列表链接）
    const allLinks = document.querySelectorAll('a');
    
    allLinks.forEach(link => {
      // 阻止默认的点击行为
      link.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        
        // 只处理站内链接，跳过外部链接
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
          e.preventDefault();
          loadPage(href);
        }
      });
    });
  }

  // 通过AJAX加载页面内容
  function loadPage(url) {
    fetch(url)
      .then(response => response.text())
      .then(html => {
        // 解析HTML内容
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // 提取body内容
        const newBody = doc.querySelector('body');
        const newHead = doc.querySelector('head');
        
        if (newBody && newHead) {
          // 保存当前音频的播放状态
          saveMusicState();
          
          // 保存当前的播放状态
          const isPlaying = !audio.paused;
          
          // 更新页面标题
          const newTitle = newHead.querySelector('title');
          if (newTitle) {
            document.title = newTitle.textContent;
          }
          
          // 更新页面样式（保留common.css，只更新页面特有样式）
          const newStyles = newHead.querySelectorAll('style');
          if (newStyles.length > 0) {
            // 移除现有的页面特有样式
            const existingStyles = document.querySelectorAll('style');
            existingStyles.forEach(style => {
              // 只移除页面特有样式，保留可能存在的其他样式
              style.remove();
            });
            
            // 添加新的页面特有样式
            newStyles.forEach(style => {
              document.head.appendChild(style.cloneNode(true));
            });
          }
          
          // 替换body内容
          document.body.innerHTML = newBody.innerHTML;
          
          // 更新浏览器的URL
          history.pushState({}, '', url);
          
          // 重新初始化主题切换和其他功能
          initializePage();
          
          // 恢复播放状态
          if (isPlaying && !audio.paused) {
            // 音乐已经在播放，不需要做什么
          } else if (isPlaying) {
            // 音乐应该播放但被暂停了，恢复播放
            audio.play().catch(function(error) {
              console.log('自动播放被阻止:', error);
            });
          }
        }
      })
      .catch(error => {
        console.error('加载页面失败:', error);
        // 如果加载失败，使用默认的页面导航
        window.location.href = url;
      });
  }

  // 重新初始化页面功能
  function initializePage() {
    // 重新获取元素
    const themeToggle = document.getElementById('themeToggle');
    const musicToggle = document.getElementById('musicToggle');
    
    if (themeToggle) {
      // 重新绑定主题切换事件
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
      // 重新绑定音乐控制事件
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
    
    // 重新设置单页应用效果
    setupSPAApp();
    
    // 重新初始化回到顶部按钮
    setupBackToTop();
    
    // 重新初始化 Giscus 评论组件
    initializeGiscus();
  }
  
  // 初始化 Giscus 评论组件
  function initializeGiscus() {
    const commentsContainer = document.getElementById('comments');
    if (commentsContainer) {
      // 检查是否有 Giscus 脚本
      const existingGiscusScript = commentsContainer.querySelector('script[src*="giscus.app"]');
      if (existingGiscusScript) {
        // 移除现有的 Giscus 脚本
        existingGiscusScript.remove();
        
        // 创建新的 Giscus 脚本
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
        
        // 添加到评论容器
        commentsContainer.appendChild(giscusScript);
      }
    }
  }

  // 处理浏览器的前进/后退按钮
  window.addEventListener('popstate', function() {
    // 获取当前的URL
    const currentUrl = window.location.href;
    // 提取路径部分
    const path = currentUrl.replace(window.location.origin, '');
    
    // 加载对应的页面
    loadPage(path || '/');
  });

  // 初始化回到顶部按钮功能
  function setupBackToTop() {
    const backToTopBtn = document.getElementById('backToTop');
    
    if (backToTopBtn) {
      // 监听页面滚动事件
      window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
          backToTopBtn.classList.add('visible');
        } else {
          backToTopBtn.classList.remove('visible');
        }
      });
      
      // 点击回到顶部
      backToTopBtn.addEventListener('click', function() {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });
    }
  }

  // 初始化单页应用效果
  setupSPAApp();
  // 初始化回到顶部按钮
  setupBackToTop();
});
