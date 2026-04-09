import tarfile
import os

def make_tarfile(output_filename, source_dir):
    with tarfile.open(output_filename, "w:gz") as tar:
        tar.add(source_dir, arcname=os.path.basename(source_dir))

if os.path.exists("backend"):
    print("Compressing backend...")
    make_tarfile("backend.tar.gz", "backend")

if os.path.exists("dist"):
    print("Compressing dist...")
    make_tarfile("dist.tar.gz", "dist")

print("Done.")