module.exports = (sequelize, DataTypes) => {
	const GroupMember = sequelize.define(
		'GroupMember',
		{
			member_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			group_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'groups',
					key: 'group_id',
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
			status: {
				type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
				defaultValue: 'pending',
			},
			role: {
				type: DataTypes.ENUM('creator', 'member'),
				defaultValue: 'member',
			},
			joined_at: {
				type: DataTypes.DATE,
				allowNull: true,
			},
			left_at: {
				type: DataTypes.DATE,
				allowNull: true,
			},
		},
		{
			tableName: 'group_members',
			timestamps: false,
			indexes: [
				{
					unique: true,
					fields: ['group_id', 'user_id'],
				},
			],
		}
	)

	return GroupMember
}
