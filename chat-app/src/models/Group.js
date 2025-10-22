module.exports = (sequelize, DataTypes) => {
	const Group = sequelize.define(
		'Group',
		{
			group_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			group_name: {
				type: DataTypes.STRING(255),
				allowNull: false,
				validate: {
					notEmpty: true,
					len: [3, 255],
				},
			},
			creator_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
		},
		{
			tableName: 'groups',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		}
	)

	return Group
}
