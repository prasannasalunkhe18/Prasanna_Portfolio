/**
 * Portfolio contact form
 * - Delivers to prasannasalunkhe5@gmail.com via FormSubmit
 * - Client rate limits + honeypot (spam mitigation)
 *
 * First submission: check Gmail for a FormSubmit activation email and confirm it.
 */
(function () {
  "use strict";

  var ENDPOINT =
    "https://formsubmit.co/ajax/prasannasalunkhe5@gmail.com";
  var COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes between sends
  var MAX_PER_DAY = 5;
  var MIN_FILL_MS = 2500; // reject instant bot fills
  var STORAGE_LAST = "portfolio_contact_last_ts";
  var STORAGE_DAY = "portfolio_contact_day";

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function readDayState() {
    try {
      var raw = localStorage.getItem(STORAGE_DAY);
      if (!raw) return { day: todayKey(), count: 0 };
      var parsed = JSON.parse(raw);
      if (!parsed || parsed.day !== todayKey()) {
        return { day: todayKey(), count: 0 };
      }
      return { day: parsed.day, count: Number(parsed.count) || 0 };
    } catch (e) {
      return { day: todayKey(), count: 0 };
    }
  }

  function writeDayState(state) {
    try {
      localStorage.setItem(STORAGE_DAY, JSON.stringify(state));
    } catch (e) {
      /* ignore quota / private mode */
    }
  }

  function getLastSubmitTs() {
    try {
      return Number(localStorage.getItem(STORAGE_LAST)) || 0;
    } catch (e) {
      return 0;
    }
  }

  function setLastSubmitTs(ts) {
    try {
      localStorage.setItem(STORAGE_LAST, String(ts));
    } catch (e) {
      /* ignore */
    }
  }

  function rateLimitMessage() {
    var last = getLastSubmitTs();
    var now = Date.now();
    var remaining = COOLDOWN_MS - (now - last);
    if (last && remaining > 0) {
      var mins = Math.ceil(remaining / 60000);
      return (
        "Please wait " +
        mins +
        " minute" +
        (mins === 1 ? "" : "s") +
        " before sending another message."
      );
    }
    var day = readDayState();
    if (day.count >= MAX_PER_DAY) {
      return (
        "Daily limit reached (" +
        MAX_PER_DAY +
        " messages). Please email me directly or try again tomorrow."
      );
    }
    return null;
  }

  function markSuccessfulSubmit() {
    var now = Date.now();
    setLastSubmitTs(now);
    var day = readDayState();
    day.count += 1;
    writeDayState(day);
  }

  function showFail(block, message) {
    var fail = block.querySelector(".w-form-fail");
    var success = block.querySelector(".w-form-done, .contact-me_success");
    if (success) success.style.display = "none";
    if (fail) {
      fail.style.display = "block";
      var text = fail.querySelector("div") || fail;
      if (message) text.textContent = message;
    } else if (message) {
      alert(message);
    }
  }

  function showSuccess(block, form) {
    var fail = block.querySelector(".w-form-fail");
    var success = block.querySelector(".w-form-done, .contact-me_success");
    if (fail) fail.style.display = "none";
    if (form) form.style.display = "none";
    if (success) success.style.display = "block";
  }

  function ensureFailBox(block) {
    if (block.querySelector(".w-form-fail")) return;
    var fail = document.createElement("div");
    fail.className = "w-form-fail";
    fail.style.display = "none";
    fail.innerHTML =
      "<div>Oops! Something went wrong while submitting the form.</div>";
    block.appendChild(fail);
  }

  function wireForm(form) {
    var block = form.closest(".contact-me_form-block, .w-form") || form.parentElement;
    ensureFailBox(block);
    form.setAttribute("method", "POST");
    form.setAttribute("novalidate", "novalidate");

    // Honeypot — leave empty; bots often fill it
    if (!form.querySelector('[name="website"]')) {
      var hp = document.createElement("input");
      hp.type = "text";
      hp.name = "website";
      hp.tabIndex = -1;
      hp.autocomplete = "off";
      hp.setAttribute("aria-hidden", "true");
      hp.style.cssText =
        "position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;";
      form.appendChild(hp);
    }

    var openedAt = Date.now();
    form.addEventListener(
      "submit",
      function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();

      var limitMsg = rateLimitMessage();
      if (limitMsg) {
        showFail(block, limitMsg);
        return;
      }

      if (Date.now() - openedAt < MIN_FILL_MS) {
        showFail(block, "Please take a moment to fill out the form.");
        return;
      }

      var honeypot = form.querySelector('[name="website"]');
      if (honeypot && honeypot.value.trim() !== "") {
        // Silent success for bots
        showSuccess(block, form);
        return;
      }

      var nameInput = form.querySelector('[name="name"]');
      var emailInput = form.querySelector('[name="email"]');
      var messageInput =
        form.querySelector('[name="message"]') ||
        form.querySelector('[name="message-2"]') ||
        form.querySelector("textarea");

      var name = nameInput ? nameInput.value.trim() : "";
      var email = emailInput ? emailInput.value.trim() : "";
      var message = messageInput ? messageInput.value.trim() : "";

      if (name.length < 2) {
        showFail(block, "Please enter your name.");
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFail(block, "Please enter a valid email address.");
        return;
      }
      if (message.length < 10) {
        showFail(block, "Please include a short project summary (at least 10 characters).");
        return;
      }
      if (message.length > 5000) {
        showFail(block, "Message is too long (max 5000 characters).");
        return;
      }

      var submitBtn = form.querySelector('[type="submit"]');
      var originalLabel = submitBtn ? submitBtn.value : "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.value = submitBtn.getAttribute("data-wait") || "Please wait...";
      }

      fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: name,
          email: email,
          message: message,
          _subject: "Portfolio contact from " + name,
          _template: "table",
          _captcha: "false",
          _replyto: email,
        }),
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data };
          });
        })
        .then(function (result) {
          var data = result.data || {};
          var msg = String(data.message || "");
          var needsActivation = /activation|activate form/i.test(msg);

          // First-time FormSubmit setup: activation email was sent to inbox
          if (needsActivation) {
            markSuccessfulSubmit();
            showFail(
              block,
              "Almost there — check prasannasalunkhe5@gmail.com for a FormSubmit activation email and click Activate Form. After that, messages will arrive normally."
            );
            return;
          }

          if (!result.ok || data.success === "false" || data.success === false) {
            throw new Error(msg || "Submit failed");
          }
          markSuccessfulSubmit();
          showSuccess(block, form);
        })
        .catch(function () {
          showFail(
            block,
            "Could not send your message. Please email prasannasalunkhe5@gmail.com directly."
          );
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.value = originalLabel || "Submit";
          }
        });
    },
      true
    );
  }

  function init() {
    var forms = document.querySelectorAll("form.contact-me_form");
    for (var i = 0; i < forms.length; i++) {
      wireForm(forms[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
