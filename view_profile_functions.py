import time
import logging

from google.appengine.ext import ndb
from google.appengine.api import memcache

from models import *
from helper_operations import get_post_notifications
from helper_db_operations import get_feed

# from helper_operations import add_user_name_image

def get_user_groups(user_key):
	
	user = user_key.get()
	result = {
		'all_groups_data': None,
		'admin_group_ids' : None
	}

	user_groups = user.groups
	if not user.groups:
		return result

	user_admin_groups = user.admin_groups

	#get list ids of the groups to which user is admin
	user_admin_group_ids = [key.id() for key in user_admin_groups]

	all_groups = ndb.get_multi(user_groups)
	all_groups_data = []

	for g in all_groups:
		group_data = g.to_dict(include = ['name', 'description', 
										  'cover_image_url'])
		group_data['id'] = g.key.id()

		#add private string
		private_str = "Public group"
		if g.private:
			private_str = "Private group"
		group_data['private_str'] = private_str

		#add string for members
		members = len(g.members)
		members_str = str(members) + ' members'
		if members == 1:
			members_str = str(members) + ' member'
		group_data['members_str'] = members_str

		group_data['url'] = '/group/' + group_data['id']
		all_groups_data.append(group_data)

	result['all_groups_data'] = all_groups_data
	result['admin_group_ids'] = user_admin_group_ids
	return result

def get_user_posts(user_id, cursor_str):
	# this method simply calls the general get_feed method with user_id as query
	# parameter and add_poster False (since user is viewing his own posts)

	result = get_feed(user_id = user_id, cursor_str = cursor_str, add_poster = False)

	return result

def get_user_notifications(user_id, timestamp):

	# this functions calls the general get_post_notifications with history as true
	# to fetch older notifications on consective calls
	notifications = get_post_notifications(user_id, timestamp, history = True)
	return notifications

