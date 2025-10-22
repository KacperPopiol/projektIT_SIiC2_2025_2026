module.exports = (sequelize, DataTypes) => {
	const Conversation = sequelize.define(
		'Conversation',
		{
			conversation_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			conversation_type: {
				type: DataTypes.ENUM('private', 'group'),
				allowNull: false,
			},
			group_id: {
				type: DataTypes.INTEGER,
				allowNull: true,
				references: {
					model: 'groups',
					key: 'group_id',
				},
			},
		},
		{
			tableName: 'conversations',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: false,
		}
	)

	return Conversation
}
