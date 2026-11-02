(function () {
  var mounted = false;
  function hideChrome() {
    var login = document.getElementById("login-overlay");
    if (login) login.classList.add("hidden");
    var unauth = document.getElementById("unauthorized-overlay");
    if (unauth) unauth.classList.add("hidden");
  }
  function mount() {
    hideChrome();
    if (mounted || typeof buildTaskCard !== "function") return;
    try {
      localStorage.setItem("task_images_expanded_t1", "true");
      localStorage.setItem("task_minimized_t1", "false");
      var task = {
        id: "t1",
        title: "Lightbox lead",
        descripcion: "thumb",
        prioridad: "Major",
        estado: "Pending",
        rama: "main",
        tema_principal: "QA / Testing",
        images: [{ url: "/harness-thumb.svg", type: "file" }],
      };
      currentTasks = [task];
      var card = buildTaskCard(task);
      card.id = "task-card";
      card.style.cssText = "width:320px;margin:48px;position:relative;z-index:1";
      document.body.prepend(card);
      var wrap = document.getElementById("card-images-t1");
      if (wrap) {
        wrap.classList.remove("hidden");
        wrap.style.display = "block";
      }
      var img = card.querySelector("#card-images-t1 img");
      if (img) {
        var host = img.closest("button, [role='button'], div");
        if (host) host.style.cssText += ";width:96px;height:96px;display:block";
      }
      mounted = true;
    } catch (e) {
      mounted = false;
    }
  }
  setInterval(mount, 400);
})();
