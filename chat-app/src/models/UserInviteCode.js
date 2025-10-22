module.exports = (sequelize, DataTypes) => {
	const UserInviteCode = sequelize.define(
		'UserInviteCode',
		{
			code_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			user_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
			invite_code: {
				type: DataTypes.STRING(6),
				allowNull: false,
				unique: true,
			},
			expires_at: {
				type: DataTypes.DATE,
				allowNull: false,
			},
			used: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
		},
		{
			tableName: 'user_invite_codes',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: false,
		}
	)

	return UserInviteCode
}
