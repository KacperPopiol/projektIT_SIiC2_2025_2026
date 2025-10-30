module.exports = (sequelize, DataTypes) => {
	const Message = sequelize.define(
		'Message',
		{
			message_id: {
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
			sender_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
			content: {
				type: DataTypes.TEXT,
				allowNull: false,
				validate: {
					notEmpty: true,
					len: [1, 5000],
				},
			},
			deleted_by_sender: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
			is_encrypted: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
				allowNull: false,
			},
		},
		{
			tableName: 'messages',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		}
	)

	return Message
}
