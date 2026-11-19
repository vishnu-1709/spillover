// Tester sign-up and feedback forms. Sends to the Google Apps Script in config.js.
(function () {
  var cfg = window.SPILLOVER || {};
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  document.querySelectorAll("form[data-form]").forEach(function (form) {
    var status = form.querySelector(".status");
    var btn = form.querySelector('button[type="submit"]');
    var label = btn.textContent;

    function say(msg, kind) { status.textContent = msg; status.dataset.kind = kind || ""; }

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      say("");
      form.querySelectorAll("[aria-invalid]").forEach(function (el) { el.removeAttribute("aria-invalid"); });

      // checks, with the first problem focused
      var problem = null;
      form.querySelectorAll("[required]").forEach(function (el) {
        if (problem) return;
        var bad = el.type === "checkbox" ? !el.checked : !el.value.trim();
        if (!bad && el.type === "email") bad = !EMAIL.test(el.value.trim());
        if (bad) problem = el;
      });
      var optEmail = form.querySelector('input[type="email"]:not([required])');
      if (!problem && optEmail && optEmail.value.trim() && !EMAIL.test(optEmail.value.trim())) problem = optEmail;
      if (problem) {
        problem.setAttribute("aria-invalid", "true");
        problem.focus();
        var what = problem.type === "checkbox" ? "Tick the box to get the invite email." :
          problem.type === "email" ? "Enter a full email address, like name@gmail.com." :
          "Fill in this field to continue.";
        say(what, "error");
        return;
      }

      // bots fill the hidden field; people don't
      if (form.website && form.website.value) { say("Sent.", "ok"); form.reset(); return; }

      if (!cfg.formEndpoint) {
        say("Sign-ups aren't connected yet. Check back in a day or two.", "error");
        return;
      }

      var data = new URLSearchParams();
      data.append("form", form.dataset.form);
      data.append("page", location.href);
      new FormData(form).forEach(function (v, k) {
        if (k === "website") return;
        if (data.has(k) && k !== "form") data.set(k, data.get(k) + ", " + v);
        else data.append(k, v);
      });

      btn.disabled = true; btn.textContent = "Sending…";
      fetch(cfg.formEndpoint, { method: "POST", mode: "no-cors", body: data })
        .then(function () {
          form.reset();
          say(form.dataset.form === "tester"
            ? "Signed up. Watch your inbox for the invite link from Google Play."
            : "Sent. Thanks, this goes straight into the next build.", "ok");
        })
        .catch(function () {
          say("Couldn't send. Check your connection and try again.", "error");
        })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  });
})();
