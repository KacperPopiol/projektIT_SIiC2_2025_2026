module.exports = (sequelize, DataTypes) => {
	const User = sequelize.define(
		'User',
		{
			user_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			username: {
				type: DataTypes.STRING(100),
				allowNull: false,
				unique: true,
				validate: {
					notEmpty: true,
					len: [3, 100],
				},
			},
			password_hash: {
				type: DataTypes.STRING(255),
				allowNull: false,
			},
			recovery_code: {
				type: DataTypes.STRING(64),
				allowNull: false,
				unique: true,
			},
			avatar_url: {
				type: DataTypes.STRING(255),
				allowNull: true,
			},
			failed_login_attempts: {
				type: DataTypes.INTEGER,
				defaultValue: 0,
			},
			account_locked: {
				type: DataTypes.BOOLEAN,
				defaultValue: false,
			},
			notifications_enabled: {
				type: DataTypes.BOOLEAN,
				defaultValue: true,
			},
			notify_private_messages: {
				type: DataTypes.BOOLEAN,
				defaultValue: true,
			},
			notify_group_messages: {
				type: DataTypes.BOOLEAN,
				defaultValue: true,
			},
			public_key_dh: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			encrypted_private_key_dh: {
				type: DataTypes.TEXT,
				allowNull: true,
			},
			default_disappearing_time: {
				type: DataTypes.INTEGER,
				defaultValue: 60,
				allowNull: false,
			},
		},
		{
			tableName: 'users',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		}
	)

	return User
}
