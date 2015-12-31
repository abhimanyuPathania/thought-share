
define(['knockout',
		'jquery',
		'helper',
		'constants',
		'velocity',
		'velocity-ui'],
function( ko, $, helper, constants, Velocity ) {
   
ko.bindingHandlers.expandInOut = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        // This will be called when the binding is first applied to an element
        // Set up any initial state, event handlers, etc. here

        // display none set by CSS
        
    },
    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        // This will be called once when the binding is first applied to an element,
        // and again whenever any observables/computeds that are accessed change
        // Update the DOM element based on the supplied values here.

        var show = ko.unwrap(valueAccessor());

        // Since the update function is also called during initialization,
        // undefined value sent won't trigger any animation and booleans
        // only due to user actions.

        if ( show === true ) {
        	$(element).velocity( "transition.expandIn", { duration: 300 } );
        }

        if ( show === false ) {
        	$(element).velocity( "transition.expandOut", { duration: 300 } );
        }
       
    }
};

ko.bindingHandlers.shakeGroupNameField = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        //
    },

    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var shake = ko.unwrap(valueAccessor());

        if ( shake ) {
        	$(element).velocity("callout.shake", { duration: 500 });
        }       	
    }
};

ko.bindingHandlers.hideGroupNameGuide = {
    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        //
    },

    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        var hide = ko.unwrap(valueAccessor());

        if ( hide ) {
        	$(element).velocity("transition.slideUpOut", {
				duration: 300,
				display: null
			});
        }       	
    }
};

ko.bindingHandlers.animateCheckbox = {

    init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {

    },

    update: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        
        var animateOut, animateIn;
        var checkedStateElement, uncheckedStateElement;
        var effect;

        var checked = ko.unwrap(valueAccessor());
        if (checked === null) {
        	// ignore the initial call
        	return;
        }

        // to select different animation effects for checkbox and status icons
        var effectObj = {
        	checkbox : {
        		animateOut : "transition.expandOut",
        		animateIn : "transition.expandIn",
        	},

        	icon : {
        		animateOut : "transition.flipXOut",
        		animateIn : "transition.flipXIn",
        	},
        }

        // since we use the binding on only the two divs.
        if ( $(element).hasClass("checkbox-icons") ) {
        	effect = effectObj.checkbox;
        } else {
        	effect = effectObj.icon;
        }

        checkedStateElement = $(".checked-state", element);
        uncheckedStateElement = $(".unchecked-state", element);

        // checked is the state of checkbox after the user clicks
        if (checked) {
        	animateOut = uncheckedStateElement;
        	animateIn = checkedStateElement;
        } else {
        	animateOut = checkedStateElement;
        	animateIn = uncheckedStateElement;
        }

        animateOut.velocity( effect.animateOut, {
			duration: 150,
			complete: function() {
				animateIn.velocity( effect.animateIn, {
					duration: 250,
					display: "block"
				});
			}
		});
    }
};

}); // end define function