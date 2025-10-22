module.exports = (sequelize, DataTypes) => {
	const GroupInviteCode = sequelize.define(
		'GroupInviteCode',
		{
			code_id: {
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
			invite_code: {
				type: DataTypes.STRING(6),
				allowNull: false,
				unique: true,
			},
			created_by: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
			expires_at: {
				type: DataTypes.DATE,
				allowNull: false,
			},
		},
		{
			tableName: 'group_invite_codes',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: false,
		}
	)

	return GroupInviteCode
}
