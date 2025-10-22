module.exports = (sequelize, DataTypes) => {
	const MessageReadStatus = sequelize.define(
		'MessageReadStatus',
		{
			status_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			message_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'messages',
					key: 'message_id',
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
			is_read: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
			read_at: {
				type: DataTypes.DATE,
				allowNull: true,
			},
		},
		{
			tableName: 'message_read_status',
			timestamps: false,
			indexes: [
				{
					unique: true,
					fields: ['message_id', 'user_id'],
				},
			],
		}
	)

	return MessageReadStatus
}
