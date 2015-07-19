import webapp2
import datetime

from google.appengine.api import users
from google.appengine.ext import ndb
from google.appengine.api import memcache
from google.appengine.ext import blobstore
from google.appengine.ext.webapp import blobstore_handlers


from utility_handler import Handler
from feed_handler import *
from group_handler import *
from notification_handler import *
from profile_handler import *

from models import *

from helper_functions import BadUserInputError, BadImageError
from helper_operations import search_index

class LandingPageHandler(Handler, blobstore_handlers.BlobstoreUploadHandler):
    def get(self):
    	if not self.user:
    		return self.render('index.html')
        
        # means user is atleast logged in to his google account
        # check for the user account too
        if self.account:
            return self.redirect('/feed')
        
        # only render the cerate user page if the user is not in db
        image_upload_url = blobstore.create_upload_url('/')
        return self.render('create_user.html', form_action = image_upload_url)

    def post(self):
        if not self.user:
            return self.render('index.html')

        if self.account:
            return self.redirect('/feed')

        # if reaches here means we have to ceate the account

        # force user to enter his display name here
        display_name = self.request.get('display_name')
        try:
            blob = self.get_uploads()[0]
        except IndexError:
            blob = None 

        if not display_name:
            image_upload_url = blobstore.create_upload_url('/')
            error = 'display name must be present'
            # delete orphan blob
            if blob:
                blobstore.delete([blob.key()])
            return self.render('create_user.html', error = error,
                                                   form_action = image_upload_url)

        try:
            User.create_user(self.user_id, display_name, self.user.email(), blob)
        
        except BadUserInputError as e:
            # delete orphan blob
            if blob:
                blobstore.delete([blob.key()])

            #reacreate image upload url since the old one gives error
            image_upload_url = blobstore.create_upload_url('/')
            return self.render('create_user.html', error = e.value,
                                                    form_action = image_upload_url)
        
        except BadImageError as e:
            #delete the incorrect blob uploaded
            blobstore.delete([blob.key()])

            #re-create upload url and render back the form
            image_upload_url = blobstore.create_upload_url('/')
            return self.render('create_user.html', error = e.value,
                                                    form_action = image_upload_url)
        
        # user account created, redirect to feed page
        return self.redirect('/feed')
        	

class DatastoreHandler(Handler):
    def get(self):
        g = "group-1"
        result = GroupPost.fetch_posts_by_group(group_id = g, limit = None, cursor = None)
        self.render('datastore.html', result = result)
        

app = webapp2.WSGIApplication([
    ('/', LandingPageHandler),
    ('/feed', FeedHandler),
    ('/view-profile', ViewProfileHandler),
    ('/edit-profile', EditProfileHandler),
    ('/create-group', CreateGroupHandler),
    (r'/group/([a-z0-9-]{3,20})', GroupLandingPageHandler),
    (r'/join-group/([a-z0-9-]{3,20})', GroupJoiningHandler),
    (r'/admin-group/([a-z0-9-]{3,20})', GroupRequestAdminHandler),
    (r'/leave-group/([a-z0-9-]{3,20})', GroupLeavingHandler),
    (r'/edit-group/([a-z0-9-]{3,20})', GroupEditHandler),
    ('/ajax/post-group', GroupPostHandler),
    ('/ajax/group-text-search', GroupTextSearchHandler),
    ('/generate-notifications/posts', NotificationWorkerHandler),
    ('/ajax/get-user-groups', GetUserGroupsHandler),
    ('/ajax/get-group-feed', GetGroupFeedHandler),
    ('/ajax/check-post-notifications', CheckPostNotificationHandler),
    ('/ajax/get-post-notifications', GetPostNotificationsHandler),
    ('/ajax/get-request-notifications', RequestNotificationHandler),
    ('/ajax/complete-request', CompleteRequestHandler),
    ('/datastore', DatastoreHandler)
], debug=True)   

