// ============================================= //
// RECENT EVENTS — rotating photo frame           //
// Add this to your existing .js file, or paste   //
// it inside a <script> tag before </body>        //
// ============================================= //

(function () {
  const frame = document.getElementById('eventFrame');
  if (!frame) return; // safety check in case this script loads on a page without the frame

  const images = frame.querySelectorAll('.event-img');
  const captions = frame.querySelectorAll('.event-caption');
  const dotsWrap = document.getElementById('eventDots');

  let current = 0;
  const intervalMs = 4000; // how long each image stays up, in milliseconds
  let timer;

  // build one dot per event automatically
  images.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  });
  const dots = dotsWrap.querySelectorAll('.dot');

  function goTo(index) {
    images[current].classList.remove('active');
    captions[current].classList.remove('active');
    dots[current].classList.remove('active');

    current = index;

    images[current].classList.add('active');
    captions[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function next() {
    goTo((current + 1) % images.length);
  }

  function startAutoplay() {
    timer = setInterval(next, intervalMs);
  }
  function stopAutoplay() {
    clearInterval(timer);
  }

  startAutoplay();

  // pause rotation while someone hovers, so they can read the caption
  frame.addEventListener('mouseenter', stopAutoplay);
  frame.addEventListener('mouseleave', startAutoplay);
})();