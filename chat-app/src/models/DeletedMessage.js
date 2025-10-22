module.exports = (sequelize, DataTypes) => {
	const DeletedMessage = sequelize.define(
		'DeletedMessage',
		{
			deleted_id: {
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
			deleted_at: {
				type: DataTypes.DATE,
				defaultValue: DataTypes.NOW,
			},
		},
		{
			tableName: 'deleted_messages',
			timestamps: false,
			indexes: [
				{
					unique: true,
					fields: ['message_id', 'user_id'],
				},
			],
		}
	)

	return DeletedMessage
}
