# Anatomy model attribution

The 3D body in the Crew Body Map is built from **BodyParts3D 4.0**,
© The Database Center for Life Science (DBCLS), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

- Dataset: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html
- Publication: Mitsuhashi et al. (2009), *BodyParts3D: 3D structure database for anatomical concepts*.
  https://doi.org/10.1093/nar/gkn613
- Browser-ready geometry taken from **Human Atlas** by ashemag
  (https://github.com/ashemag/human-atlas, application code MIT), which simplified the
  source meshes with meshoptimizer (0.2% relative error) and converted them to metres, Y-up.

Adaptations made here: five systems kept (skin surface, skeleton, heart, arteries, muscles);
all meshes of a system merged into one buffer; positions quantised to 16 bits over the body
bounds and normals to 8 bits; files gzip-compressed. Colours, lighting and the sensor
callouts are ours.

BodyParts3D is an adult male reference anatomy. It is an illustration here, not a clinical tool.
