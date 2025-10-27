module.exports = (sequelize, DataTypes) => {
	const UserKeys = sequelize.define(
		'UserKeys',
		{
			key_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true,
			},
			user_id: {
				type: DataTypes.INTEGER,
				allowNull: false,
				unique: true,
				references: {
					model: 'users',
					key: 'user_id',
				},
			},
			// Klucz publiczny ECDH (Curve25519)
			public_key: {
				type: DataTypes.TEXT,
				allowNull: false,
			},
			// Fingerprint SHA-256 klucza publicznego
			key_fingerprint: {
				type: DataTypes.STRING(64),
				allowNull: false,
			},
			// Pre-Keys (JSON array)
			pre_keys: {
				type: DataTypes.JSON,
				defaultValue: [],
			},
			created_at: {
				type: DataTypes.DATE,
				defaultValue: DataTypes.NOW,
			},
			updated_at: {
				type: DataTypes.DATE,
				defaultValue: DataTypes.NOW,
			},
		},
		{
			tableName: 'user_keys',
			timestamps: true,
			createdAt: 'created_at',
			updatedAt: 'updated_at',
		}
	)

	return UserKeys
}
