const sequelize = require('../config/database')
const { DataTypes } = require('sequelize')

// Import all models
const User = require('./User')(sequelize, DataTypes)
const Contact = require('./Contact')(sequelize, DataTypes)
const UserInviteCode = require('./UserInviteCode')(sequelize, DataTypes)
const Group = require('./Group')(sequelize, DataTypes)
const GroupMember = require('./GroupMember')(sequelize, DataTypes)
const GroupInviteCode = require('./GroupInviteCode')(sequelize, DataTypes)
const Conversation = require('./Conversation')(sequelize, DataTypes)
const ConversationParticipant = require('./ConversationParticipant')(sequelize, DataTypes)
const Message = require('./Message')(sequelize, DataTypes)
const MessageReadStatus = require('./MessageReadStatus')(sequelize, DataTypes)
const DeletedMessage = require('./DeletedMessage')(sequelize, DataTypes)

// Define all associations/relationships
const defineAssociations = () => {
	// ==================== USER RELATIONSHIPS ====================

	// User -> Contacts (znajomi)
	User.hasMany(Contact, {
		foreignKey: 'user_id',
		as: 'contacts',
		onDelete: 'CASCADE',
	})

	User.hasMany(Contact, {
		foreignKey: 'contact_user_id',
		as: 'contactOf',
		onDelete: 'CASCADE',
	})

	// User -> UserInviteCodes (kody zaproszeniowe użytkownika)
	User.hasMany(UserInviteCode, {
		foreignKey: 'user_id',
		as: 'inviteCodes',
		onDelete: 'CASCADE',
	})

	// User -> Groups (utworzone grupy)
	User.hasMany(Group, {
		foreignKey: 'creator_id',
		as: 'createdGroups',
		onDelete: 'CASCADE',
	})

	// User -> GroupMembers (członkostwo w grupach)
	User.hasMany(GroupMember, {
		foreignKey: 'user_id',
		as: 'groupMemberships',
		onDelete: 'CASCADE',
	})

	// User -> GroupInviteCodes (utworzone kody grupowe)
	User.hasMany(GroupInviteCode, {
		foreignKey: 'created_by',
		as: 'createdGroupInvites',
		onDelete: 'CASCADE',
	})

	// User -> ConversationParticipants (uczestnictwo w konwersacjach)
	User.hasMany(ConversationParticipant, {
		foreignKey: 'user_id',
		as: 'conversations',
		onDelete: 'CASCADE',
	})

	// User -> Messages (wysłane wiadomości)
	User.hasMany(Message, {
		foreignKey: 'sender_id',
		as: 'sentMessages',
		onDelete: 'CASCADE',
	})

	// User -> MessageReadStatus (statusy odczytania)
	User.hasMany(MessageReadStatus, {
		foreignKey: 'user_id',
		as: 'readStatuses',
		onDelete: 'CASCADE',
	})

	// User -> DeletedMessages (usunięte wiadomości)
	User.hasMany(DeletedMessage, {
		foreignKey: 'user_id',
		as: 'deletedMessages',
		onDelete: 'CASCADE',
	})

	// ==================== CONTACT RELATIONSHIPS ====================

	Contact.belongsTo(User, {
		foreignKey: 'user_id',
		as: 'user',
	})

	Contact.belongsTo(User, {
		foreignKey: 'contact_user_id',
		as: 'contactUser',
	})

	Contact.belongsTo(User, {
		foreignKey: 'requested_by',
		as: 'requester',
	})

	// ==================== USER INVITE CODE RELATIONSHIPS ====================

	UserInviteCode.belongsTo(User, {
		foreignKey: 'user_id',
		as: 'user',
	})

	// ==================== GROUP RELATIONSHIPS ====================

	Group.belongsTo(User, {
		foreignKey: 'creator_id',
		as: 'creator',
	})

	Group.hasMany(GroupMember, {
		foreignKey: 'group_id',
		as: 'members',
		onDelete: 'CASCADE',
	})

	Group.hasMany(GroupInviteCode, {
		foreignKey: 'group_id',
		as: 'inviteCodes',
		onDelete: 'CASCADE',
	})

	Group.hasOne(Conversation, {
		foreignKey: 'group_id',
		as: 'conversation',
		onDelete: 'CASCADE',
	})

	// ==================== GROUP MEMBER RELATIONSHIPS ====================

	GroupMember.belongsTo(Group, {
		foreignKey: 'group_id',
		as: 'group',
	})

	GroupMember.belongsTo(User, {
		foreignKey: 'user_id',
		as: 'user',
	})

	// ==================== GROUP INVITE CODE RELATIONSHIPS ====================

	GroupInviteCode.belongsTo(Group, {
		foreignKey: 'group_id',
		as: 'group',
	})

	GroupInviteCode.belongsTo(User, {
		foreignKey: 'created_by',
		as: 'creator',
	})

	// ==================== CONVERSATION RELATIONSHIPS ====================

	Conversation.belongsTo(Group, {
		foreignKey: 'group_id',
		as: 'group',
	})

	Conversation.hasMany(ConversationParticipant, {
		foreignKey: 'conversation_id',
		as: 'participants',
		onDelete: 'CASCADE',
	})

	Conversation.hasMany(Message, {
		foreignKey: 'conversation_id',
		as: 'messages',
		onDelete: 'CASCADE',
	})

	// ==================== CONVERSATION PARTICIPANT RELATIONSHIPS ====================

	ConversationParticipant.belongsTo(Conversation, {
		foreignKey: 'conversation_id',
		as: 'conversation',
	})

	ConversationParticipant.belongsTo(User, {
		foreignKey: 'user_id',
		as: 'user',
	})

	// ==================== MESSAGE RELATIONSHIPS ====================

	Message.belongsTo(Conversation, {
		foreignKey: 'conversation_id',
		as: 'conversation',
	})

	Message.belongsTo(User, {
		foreignKey: 'sender_id',
		as: 'sender',
	})

	Message.hasMany(MessageReadStatus, {
		foreignKey: 'message_id',
		as: 'readStatuses',
		onDelete: 'CASCADE',
	})

	Message.hasMany(DeletedMessage, {
		foreignKey: 'message_id',
		as: 'deletions',
		onDelete: 'CASCADE',
	})

	// ==================== MESSAGE READ STATUS RELATIONSHIPS ====================

	MessageReadStatus.belongsTo(Message, {
		foreignKey: 'message_id',
		as: 'message',
	})

	MessageReadStatus.belongsTo(User, {
		foreignKey: 'user_id',
		as: 'user',
	})

	// ==================== DELETED MESSAGE RELATIONSHIPS ====================

	DeletedMessage.belongsTo(Message, {
		foreignKey: 'message_id',
		as: 'message',
	})

	DeletedMessage.belongsTo(User, {
		foreignKey: 'user_id',
		as: 'user',
	})
}

// Execute associations
defineAssociations()

// Export all models and sequelize instance
const db = {
	sequelize,
	Sequelize: require('sequelize'),
	User,
	Contact,
	UserInviteCode,
	Group,
	GroupMember,
	GroupInviteCode,
	Conversation,
	ConversationParticipant,
	Message,
	MessageReadStatus,
	DeletedMessage,
}

module.exports = db
