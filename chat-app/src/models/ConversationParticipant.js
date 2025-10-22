module.exports = (sequelize, DataTypes) => {
	const ConversationParticipant = sequelize.define(
		'ConversationParticipant',
		{
			participant_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			conversation_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'conversations',
					key: 'conversation_id',
				},
			},
			user_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
			is_archived: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
			archived_at: {
				type: DataTypes.DATE,
				allowNull: true,
			},
		},
		{
			tableName: 'conversation_participants',
			timestamps: false,
			indexes: [
				{
					unique: true,
					fields: ['conversation_id', 'user_id'],
				},
			],
		}
	)

	return ConversationParticipant
}
