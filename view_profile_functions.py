import time
import logging

from google.appengine.ext import ndb
from google.appengine.api import memcache

from models import *
from helper_operations import get_post_notifications
from helper_db_operations import get_feed

def get_user_groups(user_key):
	## used in # profile_handler
	
	user = user_key.get()
	user_groups = user.groups

	all_groups_data = []
	# if user has not joined any groups return the default dict with both keys as None
	if not user.groups:
		return all_groups_data

	all_groups = ndb.get_multi(user_groups)

	for g in all_groups:
		group_data = g.to_dict(include = ['name', 'cover_image_url'])
		group_data['id'] = g.key.id()

		#add private boolean
		group_data['private'] = False
		if g.private:
			group_data['private'] = True

		#add string for members
		members = len(g.members)
		members_str = str(members) + ' members'
		if members == 1:
			members_str = str(members) + ' member'
		group_data['members_str'] = members_str

		# url to group landing page
		group_data['url'] = '/group/' + group_data['id']

		# set admin when requesting user is admin to the group
		group_data['admin'] = False
		if user_key in g.admins:
			group_data['admin'] = True

		# add the creator property
		group_data['creator'] = False
		if g.creator == user_key:
			group_data['creator'] = True

		all_groups_data.append(group_data)

	return all_groups_data

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

