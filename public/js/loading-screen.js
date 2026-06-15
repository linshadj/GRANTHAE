(function () {
  const DEFAULT_MESSAGE = "Loading";
  const FETCH_MESSAGE = "Processing";
  const FORM_MESSAGE = "Saving";
  const NAVIGATION_MESSAGE = "Loading page";
  const SHOW_DELAY_MS = 180;
  const NAVIGATION_DELAY_MS = 80;
  const MIN_VISIBLE_MS = 320;

  let activeCount = 0;
  let showTimer = null;
  let hideTimer = null;
  let visibleAt = 0;
  let currentMessage = DEFAULT_MESSAGE;
  let overlay = null;
  let messageNode = null;

  function findElements() {
    if (!overlay) {
      overlay = document.getElementById("global-loading-screen");
      messageNode = document.getElementById("global-loading-message");
    }

    return Boolean(overlay);
  }

  function setMessage(message) {
    currentMessage = message || DEFAULT_MESSAGE;

    if (messageNode) {
      messageNode.textContent = currentMessage;
    }
  }

  function renderIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function reveal() {
    if (!findElements()) return;

    clearTimeout(hideTimer);
    setMessage(currentMessage);
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("loading-screen-active");
    visibleAt = Date.now();
    renderIcons();
  }

  function conceal() {
    if (!findElements()) return;

    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("loading-screen-active");
  }

  function showLoading(message, delayMs) {
    activeCount += 1;
    setMessage(message);
    clearTimeout(hideTimer);

    if (overlay?.classList.contains("is-visible")) {
      return true;
    }

    if (!showTimer) {
      showTimer = setTimeout(() => {
        showTimer = null;
        if (activeCount > 0) {
          reveal();
        }
      }, delayMs ?? SHOW_DELAY_MS);
    }

    return true;
  }

  function hideLoading() {
    activeCount = Math.max(0, activeCount - 1);

    if (activeCount > 0) return;

    clearTimeout(showTimer);
    showTimer = null;

    if (!overlay?.classList.contains("is-visible")) return;

    const elapsed = Date.now() - visibleAt;
    const waitMs = Math.max(0, MIN_VISIBLE_MS - elapsed);

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (activeCount === 0) {
        conceal();
      }
    }, waitMs);
  }

  function resetLoading() {
    activeCount = 0;
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    showTimer = null;
    hideTimer = null;
    conceal();
  }

  function getRequestMethod(input, init) {
    if (init?.method) return init.method.toUpperCase();
    if (input && typeof input === "object" && "method" in input && input.method) {
      return input.method.toUpperCase();
    }

    return "GET";
  }

  function getHeaderValue(headers, name) {
    if (!headers) return "";

    try {
      return new Headers(headers).get(name) || "";
    } catch (error) {
      return "";
    }
  }

  function shouldTrackFetch(input, init) {
    const method = getRequestMethod(input, init);
    const skipHeader = getHeaderValue(init?.headers, "X-Skip-Loading")
      || getHeaderValue(input?.headers, "X-Skip-Loading");

    if (init?.loading === false || skipHeader === "true") return false;
    if (init?.loading === true) return true;

    return method !== "GET" && method !== "HEAD";
  }

  function trackFetch() {
    if (!window.fetch) return;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async function trackedFetch(input, init) {
      const shouldTrack = shouldTrackFetch(input, init);
      let started = false;
      let timer = null;

      if (shouldTrack) {
        timer = setTimeout(() => {
          started = showLoading(init?.loadingMessage || FETCH_MESSAGE, 0);
        }, SHOW_DELAY_MS);
      }

      try {
        return await originalFetch(input, init);
      } finally {
        clearTimeout(timer);

        if (started) {
          hideLoading();
        }
      }
    };
  }

  function isSamePageHash(url) {
    return url.origin === window.location.origin
      && url.pathname === window.location.pathname
      && url.search === window.location.search
      && Boolean(url.hash);
  }

  function shouldTrackLink(anchor, event) {
    if (!anchor || event.defaultPrevented || event.button !== 0) return false;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    if (anchor.hasAttribute("data-no-loading") || anchor.closest("[data-no-loading]")) return false;
    if (anchor.hasAttribute("download")) return false;
    if (anchor.target && anchor.target !== "_self") return false;

    const rawHref = anchor.getAttribute("href") || "";
    const normalizedHref = rawHref.trim().toLowerCase();

    if (!rawHref || normalizedHref === "#" || normalizedHref.startsWith("#")) return false;
    if (normalizedHref.startsWith("javascript:") || normalizedHref.startsWith("mailto:") || normalizedHref.startsWith("tel:")) return false;

    let url;

    try {
      url = new URL(anchor.href, window.location.href);
    } catch (error) {
      return false;
    }

    if (url.origin !== window.location.origin) return false;
    if (isSamePageHash(url)) return false;
    if (url.pathname.includes("/download/") || url.pathname.endsWith("/invoice")) return false;

    return true;
  }

  function shouldTrackForm(form, event) {
    if (!form || event.defaultPrevented) return false;
    if (form.hasAttribute("data-no-loading") || form.closest("[data-no-loading]")) return false;
    if (form.target && form.target !== "_self") return false;

    return true;
  }

  function bindDomEvents() {
    findElements();

    document.addEventListener("click", (event) => {
      const anchor = event.target.closest?.("a[href]");

      if (!shouldTrackLink(anchor, event)) return;

      showLoading(anchor.dataset.loadingText || NAVIGATION_MESSAGE, NAVIGATION_DELAY_MS);
    });

    document.addEventListener("submit", (event) => {
      const form = event.target;

      setTimeout(() => {
        if (!shouldTrackForm(form, event)) return;

        showLoading(form.dataset.loadingText || FORM_MESSAGE, SHOW_DELAY_MS);
      }, 0);
    });

    window.addEventListener("pageshow", resetLoading);
  }

  window.GranthaLoading = {
    show: showLoading,
    hide: hideLoading,
    reset: resetLoading,
    withLoading: async function withLoading(task, message) {
      showLoading(message || FETCH_MESSAGE, 0);

      try {
        return await task();
      } finally {
        hideLoading();
      }
    },
  };

  trackFetch();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindDomEvents, { once: true });
  } else {
    bindDomEvents();
  }
}());
