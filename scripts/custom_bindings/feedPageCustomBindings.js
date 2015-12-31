
define(['knockout',
		'jquery',
		'helper',
		'constants',
		'velocity',
		'velocity-ui'],
function( ko, $, helper, constants, Velocity ) {
   
	ko.bindingHandlers.styleCurrentGroup = {
	    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
	        // This will be called when the binding is first applied to an element
	        // Set up any initial state, event handlers, etc. here
	        var currentGroup = ko.unwrap(valueAccessor());
	        if(!currentGroup) {
	        	return;
	        }

	        // using setTimeout here to initialize the first active class
	        // since group-items are inserted into dom using ko foreach binding
	        setTimeout(function(){
	        	var selector = ".group-item[data-group-id=" + currentGroup.id + "]";
	        	$(selector, element).addClass("active");
	        }, 100);
	    },
	    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
	        // This will be called once when the binding is first applied to an element,
	        // and again whenever any observables/computeds that are accessed change
	        // Update the DOM element based on the supplied values here.

	        var currentGroup = ko.unwrap(valueAccessor());
	        if(!currentGroup) {
	        	return;
	        }

	        var active = $(".active", element);
	        // this returns the very first update call after init call
	        // the active class is not set by the init call but from setTimeout within it
	        if (!active.length){
	        	return;
	        }

	        var selector = ".group-item[data-group-id=" + currentGroup.id + "]";

	        //remove the active class from previous current group and apply on current
	        active.removeClass("active");
	       	$(selector, element).addClass("active");
	    }
	};

	//custom binding for moreFeed button, required to sync animation with delays
	ko.bindingHandlers.fadeMoreFeed = {
	    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
	    	var delay = bindingContext["$root"].fadeDelay;
	        
	        var show = ko.unwrap(valueAccessor());
     		if (!show) {
     			$(element).css("display", "none");
     		} else {
     			$(element).velocity("fadeIn", {
     				duration: 400,
     				delay: delay
     			});
     		}
	    },
	    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
	    	var delay = bindingContext["$root"].fadeDelay;
	        var show = ko.unwrap(valueAccessor());
	        if (!show) {
	        	$(element).css("display", "none");
	        } else {
	        	$(element).velocity("fadeIn", {
	        		duration: 400,
	        		delay: delay
	        	});
	        }
	    }
	};


	ko.bindingHandlers.fadeNewFeed = {
	    init: function(element, valueAccessor) {
	        
	        var show = ko.unwrap(valueAccessor());
     		if (!show) {
     			$(element).css("display", "none");
     		} else {
     			$(element).velocity("fadeIn", {
     				duration: 400,
     				display:"flex"
     			});
     		}
	    },
	    update: function(element, valueAccessor) {

	        var show = ko.unwrap(valueAccessor());
	        if (!show) {
	        	$(element).css("display", "none");
	        } else {
	        	$(element).velocity("fadeIn", {
	        		duration: 400,
	        		display:"flex"
	        	});
	        }
	    }
	};
	

	//custom binding for moreFeed button, required to sync animation with delays
	ko.bindingHandlers.showFillerMessage = {
	    init: function(element, valueAccessor) {
	    	//
	    },
	    update: function(element, valueAccessor) {

	        var show = ko.unwrap(valueAccessor());
	        if (show === true) {
	        	$(element).velocity("fadeIn", {
	        		duration: 300
	        	});
	        }
	        if (show === false) {
	        	$(element).css({
	        		display: "none",
	        		opacity: 0
	        	})
	        }
	    }
	};


}); // end define function
