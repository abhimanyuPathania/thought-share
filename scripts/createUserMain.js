
requirejs.config({
    paths: { 
        /* Load jquery from google cdn. On fail, load local file. */
        'jquery': ['//ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min', 'libs/jquery'],     
        'knockout': ['//cdnjs.cloudflare.com/ajax/libs/knockout/3.3.0/knockout-min', 'libs/knockout'],
        'velocity': ['//cdn.jsdelivr.net/velocity/1.2.2/velocity.min', 'libs/velocity'],
        'velocity-ui': ['//cdn.jsdelivr.net/velocity/1.2.2/velocity.ui.min', 'libs/velocity-ui']
    }
});

require(	
	['knockout',
    'viewmodels/createUser',
	'libs/domReady!'],
	function ( ko, CreateUserViewModel ) {	
		ko.applyBindings( new CreateUserViewModel() );
});