

var largeText = document.querySelector("#largeText span"); //span
var tagline = document.querySelector("#tagline span"); //span
var googleButton = document.querySelector("#googleSignup a"); //a tag
var bar = document.querySelector("#bar"); //div

// detect the animation end event
var animationEndEvent = whichAnimationEvent();
largeText.addEventListener(animationEndEvent, addVisibleClass);

function addVisibleClass() {

	// add visible class to trigger transition
	tagline.classList.add("visible");
	googleButton.classList.add("visible");
  bar.classList.add("visible");
}


// from modernizer.js
function whichAnimationEvent(){
  var t,
      el = document.createElement("fakeelement");

  var animations = {
    "animation"      : "animationend",
    "OAnimation"     : "oAnimationEnd",
    "MozAnimation"   : "animationend",
    "WebkitAnimation": "webkitAnimationEnd"
  }

  for (t in animations){
    if (el.style[t] !== undefined){
      return animations[t];
    }
  }
}

